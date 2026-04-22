#!/usr/bin/env bash
# ============================================================
# infra-setup.sh  --  one-time AWS infrastructure for ed-triage
#
# Run from the repo root AFTER sourcing your .env:
#   source .env && ./scripts/infra-setup.sh
#
# Requires: aws CLI, docker, jq, openssl
# ============================================================
set -euo pipefail

# ---- configuration -----------------------------------------
APP_NAME="ed-triage"
REGION="${AWS_REGION:-us-east-2}"
ACCOUNT_ID="${AWS_ACCOUNT_ID}"
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
ECR_REPO_BACKEND="${APP_NAME}-backend"

VPC_CIDR="10.0.0.0/16"
PUBLIC_CIDR_1="10.0.1.0/24"
PUBLIC_CIDR_2="10.0.2.0/24"
PRIVATE_CIDR_1="10.0.11.0/24"
PRIVATE_CIDR_2="10.0.12.0/24"

DB_NAME="ed_triage"
DB_USER="postgres"
DB_PASS="${DB_PASSWORD:-$(openssl rand -base64 20 | tr -dc 'A-Za-z0-9' | head -c 20)}"

SECRET_KEY_PROD="${APP_SECRET_KEY:-$(openssl rand -hex 32)}"
# ---- helpers -----------------------------------------------
log() { echo "▶  $*"; }

require_var() {
  local var="$1"
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: required env var $var is not set." >&2
    exit 1
  fi
}

require_var AWS_ACCOUNT_ID
require_var ANTHROPIC_API_KEY
require_var LANGFUSE_PUBLIC_KEY
require_var LANGFUSE_SECRET_KEY
require_var LANGFUSE_BASE_URL


# ============================================================
# 1. ECR repository
# ============================================================
log "Creating ECR repository..."
aws ecr describe-repositories --repository-names "${ECR_REPO_BACKEND}" --region "${REGION}" 2>/dev/null \
  || aws ecr create-repository \
       --repository-name "${ECR_REPO_BACKEND}" \
       --image-scanning-configuration scanOnPush=true \
       --region "${REGION}" \
       --output json > /dev/null

log "ECR: ${ECR_REGISTRY}/${ECR_REPO_BACKEND}"


# ============================================================
# 2. VPC + networking
# ============================================================
log "Creating VPC..."
VPC_ID=$(aws ec2 create-vpc --cidr-block "${VPC_CIDR}" \
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=${APP_NAME}-vpc}]" \
  --query 'Vpc.VpcId' --output text --region "${REGION}")
aws ec2 modify-vpc-attribute --vpc-id "${VPC_ID}" --enable-dns-hostnames --region "${REGION}"

AZ1=$(aws ec2 describe-availability-zones --region "${REGION}" \
  --query 'AvailabilityZones[0].ZoneName' --output text)
AZ2=$(aws ec2 describe-availability-zones --region "${REGION}" \
  --query 'AvailabilityZones[1].ZoneName' --output text)

log "Creating subnets in ${AZ1} and ${AZ2}..."
PUB_SUBNET_1=$(aws ec2 create-subnet --vpc-id "${VPC_ID}" --cidr-block "${PUBLIC_CIDR_1}" \
  --availability-zone "${AZ1}" \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${APP_NAME}-pub-1}]" \
  --query 'Subnet.SubnetId' --output text --region "${REGION}")
PUB_SUBNET_2=$(aws ec2 create-subnet --vpc-id "${VPC_ID}" --cidr-block "${PUBLIC_CIDR_2}" \
  --availability-zone "${AZ2}" \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${APP_NAME}-pub-2}]" \
  --query 'Subnet.SubnetId' --output text --region "${REGION}")
PRIV_SUBNET_1=$(aws ec2 create-subnet --vpc-id "${VPC_ID}" --cidr-block "${PRIVATE_CIDR_1}" \
  --availability-zone "${AZ1}" \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${APP_NAME}-priv-1}]" \
  --query 'Subnet.SubnetId' --output text --region "${REGION}")
PRIV_SUBNET_2=$(aws ec2 create-subnet --vpc-id "${VPC_ID}" --cidr-block "${PRIVATE_CIDR_2}" \
  --availability-zone "${AZ2}" \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${APP_NAME}-priv-2}]" \
  --query 'Subnet.SubnetId' --output text --region "${REGION}")

aws ec2 modify-subnet-attribute --subnet-id "${PUB_SUBNET_1}" --map-public-ip-on-launch --region "${REGION}"
aws ec2 modify-subnet-attribute --subnet-id "${PUB_SUBNET_2}" --map-public-ip-on-launch --region "${REGION}"

log "Attaching Internet Gateway..."
IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=${APP_NAME}-igw}]" \
  --query 'InternetGateway.InternetGatewayId' --output text --region "${REGION}")
aws ec2 attach-internet-gateway --vpc-id "${VPC_ID}" --internet-gateway-id "${IGW_ID}" --region "${REGION}"

RT_ID=$(aws ec2 create-route-table --vpc-id "${VPC_ID}" \
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${APP_NAME}-public-rt}]" \
  --query 'RouteTable.RouteTableId' --output text --region "${REGION}")
aws ec2 create-route --route-table-id "${RT_ID}" --destination-cidr-block 0.0.0.0/0 \
  --gateway-id "${IGW_ID}" --region "${REGION}" > /dev/null
aws ec2 associate-route-table --route-table-id "${RT_ID}" --subnet-id "${PUB_SUBNET_1}" --region "${REGION}" > /dev/null
aws ec2 associate-route-table --route-table-id "${RT_ID}" --subnet-id "${PUB_SUBNET_2}" --region "${REGION}" > /dev/null


# ============================================================
# 3. Security groups
# ============================================================
log "Creating security groups..."

ALB_SG=$(aws ec2 create-security-group \
  --group-name "${APP_NAME}-alb-sg" --description "ALB inbound" \
  --vpc-id "${VPC_ID}" --query 'GroupId' --output text --region "${REGION}")
aws ec2 authorize-security-group-ingress --group-id "${ALB_SG}" --protocol tcp \
  --port 80 --cidr 0.0.0.0/0 --region "${REGION}" > /dev/null
aws ec2 authorize-security-group-ingress --group-id "${ALB_SG}" --protocol tcp \
  --port 443 --cidr 0.0.0.0/0 --region "${REGION}" > /dev/null

ECS_SG=$(aws ec2 create-security-group \
  --group-name "${APP_NAME}-ecs-sg" --description "ECS tasks" \
  --vpc-id "${VPC_ID}" --query 'GroupId' --output text --region "${REGION}")
aws ec2 authorize-security-group-ingress --group-id "${ECS_SG}" --protocol tcp \
  --port 8000 --source-group "${ALB_SG}" --region "${REGION}" > /dev/null

DB_SG=$(aws ec2 create-security-group \
  --group-name "${APP_NAME}-db-sg" --description "RDS postgres" \
  --vpc-id "${VPC_ID}" --query 'GroupId' --output text --region "${REGION}")
aws ec2 authorize-security-group-ingress --group-id "${DB_SG}" --protocol tcp \
  --port 5432 --source-group "${ECS_SG}" --region "${REGION}" > /dev/null


# ============================================================
# 4. RDS PostgreSQL
# ============================================================
log "Creating RDS subnet group..."
aws rds create-db-subnet-group \
  --db-subnet-group-name "${APP_NAME}-db-subnets" \
  --db-subnet-group-description "DB subnets for ${APP_NAME}" \
  --subnet-ids "${PRIV_SUBNET_1}" "${PRIV_SUBNET_2}" \
  --region "${REGION}" > /dev/null 2>&1 || true

log "Creating RDS instance (this takes 5-10 min)..."
aws rds create-db-instance \
  --db-instance-identifier "${APP_NAME}-postgres" \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16 \
  --master-username "${DB_USER}" \
  --master-user-password "${DB_PASS}" \
  --db-name "${DB_NAME}" \
  --db-subnet-group-name "${APP_NAME}-db-subnets" \
  --vpc-security-group-ids "${DB_SG}" \
  --backup-retention-period 7 \
  --storage-type gp3 \
  --allocated-storage 20 \
  --no-multi-az \
  --no-publicly-accessible \
  --region "${REGION}" > /dev/null 2>&1 || log "RDS instance already exists, continuing..."

log "Waiting for RDS to become available..."
aws rds wait db-instance-available \
  --db-instance-identifier "${APP_NAME}-postgres" \
  --region "${REGION}"

DB_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier "${APP_NAME}-postgres" \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text --region "${REGION}")

DATABASE_URL="postgresql+asyncpg://${DB_USER}:${DB_PASS}@${DB_ENDPOINT}:5432/${DB_NAME}"
log "RDS endpoint: ${DB_ENDPOINT}"


# ============================================================
# 5. Secrets Manager
# ============================================================
log "Storing secrets in Secrets Manager..."
SECRET_JSON=$(jq -n \
  --arg anthropic "${ANTHROPIC_API_KEY}" \
  --arg secret_key "${SECRET_KEY_PROD}" \
  --arg db_url "${DATABASE_URL}" \
  --arg lf_pub "${LANGFUSE_PUBLIC_KEY}" \
  --arg lf_sec "${LANGFUSE_SECRET_KEY}" \
  '{
    ANTHROPIC_API_KEY: $anthropic,
    SECRET_KEY: $secret_key,
    DATABASE_URL: $db_url,
    LANGFUSE_PUBLIC_KEY: $lf_pub,
    LANGFUSE_SECRET_KEY: $lf_sec
  }')

SECRETS_ARN=$(aws secretsmanager describe-secret \
  --secret-id "${APP_NAME}/prod" --query 'ARN' --output text --region "${REGION}" 2>/dev/null \
  || aws secretsmanager create-secret \
       --name "${APP_NAME}/prod" \
       --description "Runtime secrets for ${APP_NAME} ECS tasks" \
       --secret-string "${SECRET_JSON}" \
       --region "${REGION}" \
       --query 'ARN' --output text)

# Update existing secret if it already existed
aws secretsmanager put-secret-value \
  --secret-id "${APP_NAME}/prod" \
  --secret-string "${SECRET_JSON}" \
  --region "${REGION}" > /dev/null

log "Secrets ARN: ${SECRETS_ARN}"


# ============================================================
# 6. CloudWatch log group
# ============================================================
log "Creating CloudWatch log group..."
aws logs create-log-group \
  --log-group-name "/ecs/${APP_NAME}-backend" \
  --region "${REGION}" 2>/dev/null || true


# ============================================================
# 7. IAM roles for ECS
# ============================================================
log "Creating ECS IAM roles..."

EXEC_ROLE_TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

aws iam create-role \
  --role-name "${APP_NAME}-ecs-execution-role" \
  --assume-role-policy-document "${EXEC_ROLE_TRUST}" \
  --region "${REGION}" > /dev/null 2>&1 || true

aws iam attach-role-policy \
  --role-name "${APP_NAME}-ecs-execution-role" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy > /dev/null 2>&1 || true

# Allow reading our specific secret
aws iam put-role-policy \
  --role-name "${APP_NAME}-ecs-execution-role" \
  --policy-name "${APP_NAME}-read-secrets" \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Effect\": \"Allow\",
      \"Action\": [\"secretsmanager:GetSecretValue\"],
      \"Resource\": \"${SECRETS_ARN}\"
    }]
  }" > /dev/null

# Task role (for the running container to call AWS services if needed)
aws iam create-role \
  --role-name "${APP_NAME}-ecs-task-role" \
  --assume-role-policy-document "${EXEC_ROLE_TRUST}" \
  --region "${REGION}" > /dev/null 2>&1 || true


# ============================================================
# 8. Build and push initial backend image to ECR
# ============================================================
log "Building and pushing backend Docker image..."
aws ecr get-login-password --region "${REGION}" \
  | docker login --username AWS --password-stdin "${ECR_REGISTRY}"

docker build -t "${APP_NAME}-backend" ./backend
docker tag "${APP_NAME}-backend:latest" "${ECR_REGISTRY}/${ECR_REPO_BACKEND}:latest"
docker push "${ECR_REGISTRY}/${ECR_REPO_BACKEND}:latest"


# ============================================================
# 9. ECS cluster + task definition + service
# ============================================================
log "Ensuring ECS service-linked role exists..."
aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com 2>/dev/null || true

log "Creating ECS cluster..."
aws ecs create-cluster \
  --cluster-name "${APP_NAME}-cluster" \
  --capacity-providers FARGATE \
  --region "${REGION}" > /dev/null 2>&1 || true

log "Registering ECS task definition..."
APP_NAME="${APP_NAME}" ACCOUNT_ID="${ACCOUNT_ID}" REGION="${REGION}" \
  ECR_REGISTRY="${ECR_REGISTRY}" LANGFUSE_BASE_URL="${LANGFUSE_BASE_URL}" \
  envsubst < scripts/ecs-task-def.json.template > /tmp/task-def.json

TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-def.json \
  --region "${REGION}" \
  --query 'taskDefinition.taskDefinitionArn' --output text)

log "Task definition: ${TASK_DEF_ARN}"


# ============================================================
# 10. Application Load Balancer
# ============================================================
log "Creating Application Load Balancer..."
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name "${APP_NAME}-alb" \
  --subnets "${PUB_SUBNET_1}" "${PUB_SUBNET_2}" \
  --security-groups "${ALB_SG}" \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4 \
  --region "${REGION}" \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

TG_ARN=$(aws elbv2 create-target-group \
  --name "${APP_NAME}-backend-tg" \
  --protocol HTTP \
  --port 8000 \
  --vpc-id "${VPC_ID}" \
  --target-type ip \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --region "${REGION}" \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

LISTENER_ARN=$(aws elbv2 create-listener \
  --load-balancer-arn "${ALB_ARN}" \
  --protocol HTTP \
  --port 80 \
  --default-actions "Type=forward,TargetGroupArn=${TG_ARN}" \
  --region "${REGION}" \
  --query 'Listeners[0].ListenerArn' --output text)

ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns "${ALB_ARN}" \
  --query 'LoadBalancers[0].DNSName' --output text --region "${REGION}")

log "ALB DNS: ${ALB_DNS}"


# ============================================================
# 11. ECS service
# ============================================================
log "Creating ECS service..."
aws ecs create-service \
  --cluster "${APP_NAME}-cluster" \
  --service-name "${APP_NAME}-backend" \
  --task-definition "${TASK_DEF_ARN}" \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[${PUB_SUBNET_1},${PUB_SUBNET_2}],securityGroups=[${ECS_SG}],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=${TG_ARN},containerName=${APP_NAME}-backend,containerPort=8000" \
  --region "${REGION}" > /dev/null 2>&1 || \
aws ecs update-service \
  --cluster "${APP_NAME}-cluster" \
  --service "${APP_NAME}-backend" \
  --task-definition "${TASK_DEF_ARN}" \
  --force-new-deployment \
  --region "${REGION}" > /dev/null


# ============================================================
# 12. S3 bucket for frontend (private, served via CloudFront OAC)
# ============================================================
log "Creating S3 bucket for frontend..."
S3_BUCKET="${APP_NAME}-frontend-${ACCOUNT_ID}"

if [[ "${REGION}" == "us-east-1" ]]; then
  aws s3api create-bucket \
    --bucket "${S3_BUCKET}" \
    --region "${REGION}" > /dev/null 2>&1 || true
else
  aws s3api create-bucket \
    --bucket "${S3_BUCKET}" \
    --create-bucket-configuration "LocationConstraint=${REGION}" \
    --region "${REGION}" > /dev/null 2>&1 || true
fi

aws s3api put-public-access-block \
  --bucket "${S3_BUCKET}" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  --region "${REGION}"


# ============================================================
# 13. CloudFront OAC + distribution
# ============================================================
log "Creating CloudFront Origin Access Control..."
OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config \
    "Name=${APP_NAME}-oac,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3" \
  --query 'OriginAccessControl.Id' --output text 2>/dev/null \
  || aws cloudfront list-origin-access-controls \
       --query "OriginAccessControlList.Items[?Name=='${APP_NAME}-oac'].Id | [0]" --output text)

log "Creating CloudFront distribution (2 origins: S3 + ALB /api/*)..."
CF_CONFIG=$(jq -n \
  --arg s3 "${S3_BUCKET}.s3.${REGION}.amazonaws.com" \
  --arg alb "${ALB_DNS}" \
  --arg oac "${OAC_ID}" \
  '{
    CallerReference: "ed-triage-dist-v1",
    Comment: "ED Triage frontend + API gateway",
    DefaultRootObject: "index.html",
    Origins: {
      Quantity: 2,
      Items: [
        {
          Id: "S3Origin",
          DomainName: $s3,
          S3OriginConfig: { OriginAccessIdentity: "" },
          OriginAccessControlId: $oac
        },
        {
          Id: "ALBOrigin",
          DomainName: $alb,
          CustomOriginConfig: {
            HTTPPort: 80,
            HTTPSPort: 443,
            OriginProtocolPolicy: "http-only"
          }
        }
      ]
    },
    DefaultCacheBehavior: {
      TargetOriginId: "S3Origin",
      ViewerProtocolPolicy: "redirect-to-https",
      AllowedMethods: { Quantity: 2, Items: ["GET","HEAD"], CachedMethods: { Quantity: 2, Items: ["GET","HEAD"] } },
      CachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
      Compress: true
    },
    CacheBehaviors: {
      Quantity: 1,
      Items: [
        {
          PathPattern: "/api/*",
          TargetOriginId: "ALBOrigin",
          ViewerProtocolPolicy: "https-only",
          AllowedMethods: { Quantity: 7, Items: ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"], CachedMethods: { Quantity: 2, Items: ["GET","HEAD"] } },
          CachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
          OriginRequestPolicyId: "216adef6-5c7f-47e4-b989-5492eafa07d3",
          Compress: false
        }
      ]
    },
    CustomErrorResponses: {
      Quantity: 1,
      Items: [
        { ErrorCode: 404, ResponsePagePath: "/index.html", ResponseCode: "200", ErrorCachingMinTTL: 0 }
      ]
    },
    Enabled: true,
    HttpVersion: "http2",
    PriceClass: "PriceClass_100"
  }')

CF_OUTPUT=$(aws cloudfront create-distribution \
  --distribution-config "${CF_CONFIG}" \
  --query '{id: Distribution.Id, domain: Distribution.DomainName}' \
  --output json)

CF_ID=$(echo "${CF_OUTPUT}" | jq -r '.id')
CF_DOMAIN=$(echo "${CF_OUTPUT}" | jq -r '.domain')

log "CloudFront ID: ${CF_ID}"
log "CloudFront URL: https://${CF_DOMAIN}"


# ============================================================
# 14. Grant CloudFront read access to S3 via bucket policy
# ============================================================
log "Updating S3 bucket policy for CloudFront OAC..."
aws s3api put-bucket-policy \
  --bucket "${S3_BUCKET}" \
  --policy "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Sid\": \"AllowCloudFrontOAC\",
      \"Effect\": \"Allow\",
      \"Principal\": {\"Service\": \"cloudfront.amazonaws.com\"},
      \"Action\": \"s3:GetObject\",
      \"Resource\": \"arn:aws:s3:::${S3_BUCKET}/*\",
      \"Condition\": {
        \"StringEquals\": {
          \"AWS:SourceArn\": \"arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${CF_ID}\"
        }
      }
    }]
  }"


# ============================================================
# 15. Build and deploy frontend to S3
# ============================================================
log "Building frontend..."
cd frontend
npm install --silent
npm run build
cd ..

log "Syncing frontend to S3..."
aws s3 sync frontend/dist/ "s3://${S3_BUCKET}/" \
  --delete \
  --cache-control "max-age=31536000,immutable" \
  --exclude "index.html"
aws s3 cp frontend/dist/index.html "s3://${S3_BUCKET}/index.html" \
  --cache-control "no-cache,no-store,must-revalidate"

log "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id "${CF_ID}" \
  --paths "/*" \
  --region us-east-1 > /dev/null

log "Waiting for ECS service to stabilize..."
aws ecs wait services-stable \
  --cluster "${APP_NAME}-cluster" \
  --services "${APP_NAME}-backend" \
  --region "${REGION}"


# ============================================================
# 16. Output -- GitHub secrets to configure
# ============================================================
echo ""
echo "================================================================"
echo " DONE -- set these secrets in GitHub (Settings > Secrets > Actions)"
echo "================================================================"
echo ""
echo "  AWS_ACCESS_KEY_ID      = ${AWS_ACCESS_KEY_ID}"
echo "  AWS_SECRET_ACCESS_KEY  = ${AWS_SECRET_ACCESS_KEY}"
echo "  AWS_REGION             = ${REGION}"
echo "  AWS_ACCOUNT_ID         = ${ACCOUNT_ID}"
echo "  ECR_REGISTRY           = ${ECR_REGISTRY}"
echo "  ECR_REPO_BACKEND       = ${ECR_REPO_BACKEND}"
echo "  S3_BUCKET_FRONTEND     = ${S3_BUCKET}"
echo "  CLOUDFRONT_DIST_ID     = ${CF_ID}"
echo "  ECS_CLUSTER            = ${APP_NAME}-cluster"
echo "  ECS_SERVICE            = ${APP_NAME}-backend"
echo "  LANGFUSE_BASE_URL      = ${LANGFUSE_BASE_URL}"
echo ""
echo " Your app is live at: https://${CF_DOMAIN}"
echo ""
echo " (CloudFront deployment may take 5-15 min to propagate globally)"
echo "================================================================"

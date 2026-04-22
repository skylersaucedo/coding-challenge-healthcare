# ED Triage Support

> AI-powered emergency department triage: turns a 12-minute chart review into a 5-second decision.

## Features

### Patient Intake
- Multi-step wizard collecting demographics, chief complaint, medical history, allergies, medications, surgical history, next-of-kin, and insurance
- Digital consent and HIPAA acknowledgment
- On submission the patient enters the nurse Kanban board automatically

### Nurse Kanban Board
- Drag-and-drop columns: **Intake**, **Vitals**, **Doc Visit**, **Post-Visit**
- Patient cards show arrival time, wait duration, and color-coded urgency badge
- Urgency colors: red (IMMEDIATE), amber (MONITOR), green (CAN WAIT), grey (unassessed)
- Click any card to open the detail drawer

### AI Triage Assessment
Powered by Claude (Anthropic). Triggered per-patient by a nurse or admin.

The AI receives the patient's full clinical picture before scoring:
- Intake form data (demographics, chief complaint, history, medications, allergies)
- Latest recorded vitals (HR, BP, temperature, RR, SpO2)
- All nurse notes
- Arrival time and current stage

Returns structured output validated through Pydantic:
- **Urgency**: `IMMEDIATE` / `MONITOR` / `CAN WAIT`
- **Recommended actions**: categorized as Immediate, Monitor, or Escalate/Redirect
- **Rationale**: clinical signals referenced
- **Red flags**: list of high-priority concerns
- **Follow-up checklist**: actionable items with priority and assignee
- **Missing fields**: data gaps that could affect accuracy
- **Confidence score**

### AI Follow-up (Nurse Q&A)
Nurses can ask free-text questions about a patient; Claude answers in the context of the full chart and prior assessment.

### Discharge Summary Generation
Generates a structured discharge summary from visit notes and prior assessment.

### Observability
All Anthropic API calls and HTTP requests are traced in [Langfuse](https://us.cloud.langfuse.com) under environment `coding-challenge-langfuse`. Each generation trace includes model, token counts, input/output, and patient metadata.

### Admin Dashboard
- Staff directory (name, role, specialty)
- Full patient pipeline with search and filter
- Role-based access control: `patient`, `nurse`, `admin`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, shadcn/ui, Tailwind CSS, Zustand, TanStack Query |
| Backend | FastAPI (async), SQLAlchemy 2.0, asyncpg, Pydantic v2 |
| AI | Anthropic Python SDK, Claude Sonnet 4.6, prompt caching |
| Observability | Langfuse 4.x (`observe` decorator + HTTP middleware) |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | JWT (OAuth2 password flow), role claims |

---

## Local Development

**Prerequisites:** Docker Desktop

```bash
cp .env.example .env   # fill in ANTHROPIC_API_KEY and Langfuse keys
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8001 |
| API docs | http://localhost:8001/docs |

**Demo accounts**

| Role | Email | Password |
|---|---|---|
| Admin | admin@hospital.com | admin123 |
| Nurse | nurse@hospital.com | nurse123 |
| Patient | patient@hospital.com | patient123 |

---

## AWS Architecture

```
Browser
  └── CloudFront
        ├── /* ──────────── S3 (React SPA)
        └── /api/* ──────── ALB → ECS Fargate (FastAPI)
                                          └── RDS PostgreSQL
```

All routes are prefixed `/api` so CloudFront can split traffic between origins without CORS configuration.

Secrets (API keys, DB connection string, JWT secret) are stored in AWS Secrets Manager and injected into the ECS task at runtime.

---

## CI/CD

Push to `main` triggers `.github/workflows/deploy.yml`:

1. Build and push backend Docker image to ECR
2. Render and register a new ECS task definition
3. Force a new ECS deployment and wait for stability
4. Build the React frontend and sync to S3
5. Invalidate the CloudFront cache

**Required GitHub secrets:**

| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM user key with ECR/ECS/S3/CloudFront permissions |
| `AWS_SECRET_ACCESS_KEY` | Corresponding secret |
| `AWS_ACCOUNT_ID` | 12-digit AWS account ID |
| `AWS_REGION` | e.g. `us-east-2` |
| `ECR_REGISTRY` | `<account>.dkr.ecr.<region>.amazonaws.com` |
| `ECR_REPO_BACKEND` | ECR repository name |
| `ECS_CLUSTER` | ECS cluster name |
| `ECS_SERVICE` | ECS service name |
| `S3_BUCKET_FRONTEND` | S3 bucket name for the SPA |
| `CLOUDFRONT_DIST_ID` | CloudFront distribution ID |
| `LANGFUSE_BASE_URL` | e.g. `https://us.cloud.langfuse.com` |

Runtime secrets (`ANTHROPIC_API_KEY`, `SECRET_KEY`, `DATABASE_URL`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`) are pulled from AWS Secrets Manager by the ECS task at startup.

---

## Project Structure

```
coding-challenge-healthcare/
  frontend/
    src/
      components/       # Navbar, PatientCard, PatientDetailDrawer, kanban columns
      pages/            # Login, Intake, NurseBoard, Admin
      api/              # Typed API client
      store/            # Zustand auth store
  backend/
    app/
      routers/          # auth, patients, triage, admin
      services/         # triage.py (Claude calls), auth
      models/           # SQLAlchemy: Patient, Vitals, PatientAssessment, NurseNote
      schemas/          # Pydantic I/O schemas
      core/             # config, security, DB session
    prompts/            # System prompts loaded at runtime (not hardcoded)
  scripts/
    infra-setup.sh      # One-time AWS infrastructure provisioning
    ecs-task-def.json.template
  .github/
    workflows/
      deploy.yml
  docker-compose.yml
```

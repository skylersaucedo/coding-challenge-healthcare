# ED Triage Support Assistant — Product & Technical Specification

## 1. Product Overview

A lightweight SaaS platform that augments clinical judgment in Emergency Department triage during high-volume periods. The system surfaces structured AI-assisted guidance alongside real-time patient flow management, so nurses and administrators can act faster with greater confidence.

### Core Personas

| Persona | Primary Goal | Key View |
|---|---|---|
| **Patient** | Complete intake digitally, minimal friction | Intake questionnaire wizard |
| **Nurse / Clinician** | Triage patients efficiently, track stage progression | Kanban board + AI triage panel |
| **Administrator** | Oversee ED capacity, staff, and patient pipeline | Operations dashboard |

---

## 2. Feature Breakdown

### 2.1 Patient — Intake Questionnaire

A step-by-step wizard collecting all information the hospital needs before clinical assessment begins.

**Steps:**
1. **Demographics** — Full name, date of birth, sex, approximate height/weight
2. **Chief Complaint** — Free-text symptom description + onset, severity (1–10), location
3. **Medical History** — List of known conditions (checkboxes + free-text)
4. **Allergies** — Medications, food, environmental; reaction type
5. **Surgical / Procedure History** — Prior operations with approximate dates
6. **Current Medications** — Name, dose, frequency
7. **Next of Kin / Emergency Contact** — Name, relationship, phone
8. **Insurance** — Provider, policy number, group number; photo upload option
9. **Consent & Waivers** — Digital signature capture, HIPAA acknowledgment
10. **Review & Submit**

On submission the patient enters the **Intake** column of the nurse Kanban.

---

### 2.2 Nurse — Kanban Triage Board

Interactive drag-and-drop board. Each card = one patient.

**Columns (stages):**

| Column | Description | Initial seed |
|---|---|---|
| **Intake** | Patient arrived; paperwork received | 20 patients |
| **Vitals** | Awaiting or undergoing vital signs collection | 10 patients |
| **Doc Visit** | In examination with physician | 5 patients |
| **Post-Visit / Follow-Up** | Pending discharge instructions, labs, or handoff | 4 patients |

**Patient Card** shows:
- Name, age, chief complaint
- Time in current stage (color-coded: green < 15 min, yellow < 45 min, red > 45 min)
- AI triage urgency badge: `IMMEDIATE` / `MONITOR` / `CAN WAIT`
- Quick-action buttons: move to next stage, flag, add note

**Detail Drawer** (click card):
- Full intake summary
- AI triage assessment panel:
  - Urgency classification with confidence
  - Recommended actions: Immediate / Monitor / Escalate or Redirect
  - Rationale (clinical signals referenced)
  - Follow-up checklist (assign bed, notify clinician, request vitals, flag for reassessment, handoff notes)
- Missing information warnings
- Vitals entry form
- Nurse note history

---

### 2.3 Administrator — Operations Dashboard

- **Staff Directory**: All physicians and nurses on shift — name, role, specialty, current load
- **Patient Pipeline**: Full list of all patients across all stages with search/filter
- **ED Capacity Metrics**: Beds occupied vs. available, average time per stage, throughput rate
- **AI Insights Panel**: Summary of high-urgency cases requiring escalation

---

### 2.4 AI Triage Engine

Backed by Claude (Anthropic API). For each patient the system:
1. Embeds structured + free-text intake data via Qdrant vector store
2. Retrieves relevant similar historical cases (RAG)
3. Prompts Claude with patient context + retrieved context
4. Returns structured JSON: `{ urgency, recommended_actions, rationale, checklist, missing_fields }`

Multimodal support (Phase 2): nurses can upload photos of wounds, injury sites, or documents; embedded into Qdrant alongside text.

---

## 3. Technical Architecture

### 3.1 Services & Ports

| Service | Technology | Local Port |
|---|---|---|
| **Frontend** | React + TypeScript + shadcn/ui | `3000` |
| **Backend API** | FastAPI (Python) | `8000` |
| **Vector DB** | Qdrant | `6333` (HTTP) / `6334` (gRPC) |
| **Relational DB** | PostgreSQL | `5432` |
| **Cache / Sessions** | Redis | `6379` |

### 3.2 Frontend Stack

- **Framework**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui (Radix UI primitives + Tailwind CSS)
- **Kanban**: `@hello-pangea/dnd` (maintained dnd-kit alternative) for drag-and-drop
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query v5)
- **Forms**: React Hook Form + Zod validation
- **Auth**: JWT tokens stored in httpOnly cookies; role-based route guards
- **Routing**: React Router v6

### 3.3 Backend Stack

- **Framework**: FastAPI with async SQLAlchemy (asyncpg)
- **ORM**: SQLAlchemy 2.0 models
- **Migrations**: Alembic
- **Auth**: OAuth2 password flow → JWT (python-jose); role claims: `patient | nurse | admin`
- **AI**: Anthropic Python SDK (Claude Sonnet 4.6, prompt caching enabled)
- **Vector Store**: Qdrant Python client — patient embeddings, case similarity retrieval
- **Embeddings**: `voyage-3` via Anthropic or `text-embedding-3-small` via OpenAI
- **Background Tasks**: FastAPI BackgroundTasks (Celery/Redis if async load grows)
- **Validation**: Pydantic v2

### 3.4 Data Model (simplified)

```
User            (id, email, hashed_pw, role, created_at)
Patient         (id, user_id FK, stage, urgency_level, arrived_at, updated_at)
IntakeForm      (id, patient_id FK, demographics JSONB, medical_history JSONB,
                 allergies JSONB, medications JSONB, insurance JSONB,
                 consents_signed BOOLEAN, signature_data TEXT)
Vitals          (id, patient_id FK, bp_systolic, bp_diastolic, hr, temp,
                 spo2, recorded_at, recorded_by FK)
TriageAssessment(id, patient_id FK, urgency, actions JSONB, rationale TEXT,
                 checklist JSONB, missing_fields JSONB, model_version, created_at)
NurseNote       (id, patient_id FK, author_id FK, body TEXT, created_at)
Staff           (id, user_id FK, role_title, specialty, shift_active)
```

### 3.5 Docker Compose (local)

```yaml
services:
  frontend:   port 3000, built from ./frontend
  backend:    port 8000, built from ./backend
  postgres:   port 5432, postgres:16
  qdrant:     port 6333/6334, qdrant/qdrant:latest
  redis:      port 6379, redis:7-alpine
```

All services on a shared `ed-network` bridge. Backend depends on postgres + qdrant + redis.

---

## 4. AWS Deployment Architecture

All resources tagged: `{ "project": "coding-challenge-med" }`

### 4.1 Services

| AWS Service | Purpose |
|---|---|
| **ECS Fargate** | Run frontend + backend containers |
| **ECR** | Container image registry (frontend, backend) |
| **RDS PostgreSQL** | Managed relational database (db.t3.medium) |
| **ElastiCache Redis** | Session cache (cache.t3.micro) |
| **ECS Task (Qdrant)** | Qdrant on Fargate with EFS volume for persistence |
| **EFS** | Persistent volume for Qdrant data |
| **ALB** | Application Load Balancer routing `/api/*` → backend, `/*` → frontend |
| **ACM** | TLS certificate |
| **Route 53** | DNS (optional custom domain) |
| **S3** | Insurance document / image uploads |
| **Secrets Manager** | DB passwords, API keys, JWT secret |
| **CloudWatch** | Logs and alarms |
| **Cognito** | (Optional Phase 2) Managed auth / MFA |

### 4.2 CDK Stack Layout

```
cdk/
  lib/
    network-stack.ts      # VPC, subnets, security groups
    data-stack.ts         # RDS, ElastiCache, EFS
    qdrant-stack.ts       # Qdrant ECS service + EFS mount
    backend-stack.ts      # FastAPI ECS service, ALB target group
    frontend-stack.ts     # React ECS service (or S3+CloudFront)
    pipeline-stack.ts     # CodePipeline or GitHub Actions OIDC role
```

---

## 5. CI/CD Pipeline

**Branch**: `main` triggers deployment.

### 5.1 GitHub Actions Workflow

```
on: push to main / PR to main

jobs:
  test-backend:
    - pip install, pytest, ruff lint

  test-frontend:
    - npm ci, tsc --noEmit, vitest

  cdk-diff:              # PRs only
    - cdk diff all stacks (no deploy)

  build-push:            # main only, after tests pass
    - docker build frontend + backend
    - push to ECR

  cdk-deploy:            # main only, after images pushed
    - cdk deploy --all --require-approval never

  smoke-test:            # after deploy
    - curl /api/health
    - curl /api/patients (auth token)
```

### 5.2 OIDC Auth (no long-lived keys)

GitHub OIDC → AWS IAM Role `github-actions-coding-challenge-med` with least-privilege policy scoped to ECR, ECS, CDK deployment bucket, and Secrets Manager read.

---

## 6. Project Directory Structure

```
coding-challenge-healthcare/
  frontend/
    src/
      components/
        kanban/          # Board, Column, PatientCard, DetailDrawer
        intake/          # Wizard steps
        admin/           # Staff table, metrics
        ui/              # shadcn re-exports
      hooks/
      lib/               # api client, auth, zod schemas
      pages/
      store/             # Zustand
    Dockerfile
    vite.config.ts

  backend/
    app/
      api/
        routes/          # patients, auth, triage, staff, vitals
      core/              # config, security, database
      models/            # SQLAlchemy models
      schemas/           # Pydantic schemas
      services/
        triage.py        # Claude API calls
        embeddings.py    # Qdrant ingestion
        seed.py          # 20/10/5/4 patient seed data
    Dockerfile
    alembic/

  cdk/
    bin/app.ts
    lib/                 # stacks (see above)

  docker-compose.yml
  .github/
    workflows/
      ci.yml
  PRODUCT_SPEC.md
```

---

## 7. Seed Data

On `docker compose up`, the backend runs a seed script populating:
- **4 staff users**: 2 nurses, 1 physician, 1 admin
- **39 patients** across stages:
  - 20 in Intake (varied chief complaints, incomplete data to test missing-fields logic)
  - 10 in Vitals (vitals partially or fully recorded)
  - 5 in Doc Visit (triage assessments generated)
  - 4 in Post-Visit / Follow-Up (discharge checklists populated)
- AI triage assessments pre-generated for Vitals/Doc Visit patients

---

## 8. Build Order

1. **`docker-compose.yml`** + service Dockerfiles (postgres, qdrant, redis wired up)
2. **Backend**: models → migrations → auth routes → patient CRUD → triage service → seed script
3. **Frontend**: auth shell → role routing → patient intake wizard → nurse Kanban → admin dashboard
4. **Local smoke test** via Docker Compose
5. **CDK stacks**: network → data → qdrant → backend → frontend → pipeline
6. **GitHub Actions** workflow + OIDC role
7. **First deploy** to AWS; verify ALB health checks, smoke tests pass

---

## 9. Open Questions / Decisions to Make

| Question | Default Assumption |
|---|---|
| Auth provider — custom JWT vs. Cognito? | Custom JWT for MVP; Cognito in Phase 2 |
| Frontend hosting — ECS vs. S3+CloudFront? | S3 + CloudFront (cheaper, faster) |
| Embeddings provider — Voyage vs. OpenAI? | `voyage-3` (Anthropic ecosystem) |
| Custom domain? | Not required for MVP; ALB DNS sufficient |
| HIPAA compliance scope? | Out of scope for prototype; flag for production |
| Multi-hospital / multi-tenant? | Single-tenant for MVP |

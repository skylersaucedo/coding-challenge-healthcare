# Project Changes and Architecture Decisions

This document captures key decisions, scope additions, and design choices made during the build of the ED Triage Support Assistant.

---

## Session 1: Initial Specification

### Defined

- **Product**: SaaS for emergency department triage support with three user personas: patient, nurse, and hospital administrator.
- **Nurse view**: Interactive Kanban board with four columns: Intake (20 patients), Vitals (10), Doc Visit (5), Post-Visit Follow-Up (4).
- **Patient view**: Multi-step intake wizard collecting demographics, medical history, allergies, medications, next of kin, insurance, and digital consent signatures.
- **Admin view**: Staff directory, patient pipeline, and ED capacity metrics.

### Tech stack finalized

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite + shadcn/ui | Type safety, production-ready component library, rapid iteration |
| Drag-and-drop | @hello-pangea/dnd | Actively maintained fork of react-beautiful-dnd |
| State | Zustand | Lightweight, no boilerplate |
| Data fetching | TanStack Query v5 | Caching, background refetch, optimistic updates |
| Backend | FastAPI (Python) | Async, Pydantic-native, fast to prototype |
| Primary DB | PostgreSQL + asyncpg | ACID transactions, JSONB for flexible intake data |
| Vector DB | Qdrant | Local Docker image, multimodal support for Phase 2 |
| Cache | Redis | Session storage, background task queuing |
| Auth | Custom JWT | Simpler than Cognito for MVP; Cognito deferred to Phase 2 |

### Ports

| Service | Port |
|---|---|
| Frontend | 3000 |
| Backend (FastAPI) | 8000 |
| Qdrant | 6333 (HTTP) / 6334 (gRPC) |
| PostgreSQL | 5432 |
| Redis | 6379 |

---

## Session 2: AI Integration

### Decided

- **Model**: `claude-sonnet-4-6` for all triage, follow-up, and discharge summary endpoints.
- **API**: Anthropic Python SDK (`anthropic`) called directly from FastAPI services. No LangChain, no intermediary framework.
- **Prompt storage**: All system prompts stored as Markdown files in `backend/prompts/`. Prompt text is never hardcoded in Python source files.

### Prompts created

| File | Purpose | Caching |
|---|---|---|
| `system_triage.md` | Main triage assessment system prompt with clinical framework and JSON output schema | Yes, `cache_control: ephemeral` |
| `patient_triage_request.md` | User-turn template with `{patient_json}` placeholder | No |
| `system_symptom_followup.md` | System prompt for nurse follow-up Q&A (plain text response) | Yes, `cache_control: ephemeral` |
| `system_discharge_summary.md` | System prompt for generating post-visit handoff notes | Yes, `cache_control: ephemeral` |

### AI features implemented

**Patient triage assessment** (`assess_patient_triage`)
- Input: patient intake data as a dict
- Output: `TriageAssessment` Pydantic model with urgency (IMMEDIATE / MONITOR / CAN WAIT), escalation recommendation, confidence, rationale, red flags, missing fields, and a follow-up checklist
- Uses Claude's structured output (`output_config.format` with JSON schema) to guarantee parseable, validated responses
- Prompt caching applied to the large clinical guidelines system prompt

**Symptom follow-up Q&A** (`symptom_followup`)
- Input: patient data, nurse's natural-language question, optional prior assessment
- Output: plain text answer for display in the nurse detail drawer
- Prompt caching applied to the system prompt

**Discharge summary generation** (`generate_discharge_summary`)
- Input: patient data, visit notes, optional triage assessment
- Output: `DischargeSummary` Pydantic model with structured handoff sections
- Used when moving a patient to the Post-Visit Follow-Up column

### Structured output approach

All endpoints that return structured data use Claude's native `output_config.format` with a `json_schema` derived from the Pydantic model via `model_json_schema()`. The helper `_make_strict_schema()` recursively adds `additionalProperties: false` to all object nodes, which is required for Claude's structured output mode. Responses are then validated with `model_validate_json()`.

### Prompt caching design

The clinical guidelines in `system_triage.md` are substantial (over 1024 tokens, the minimum for Sonnet 4.6). Marking the system block with `cache_control: {type: "ephemeral"}` means the first call within a 5-minute window writes the cache entry; subsequent calls read it at approximately 10% of the normal input token cost. This matters at triage volume where the same system prompt is sent repeatedly across many concurrent patients.

---

## Phase 2 Backlog (not yet built)

- Qdrant vector embeddings for similar historical case retrieval (RAG)
- Multimodal intake: wound photo uploads embedded into Qdrant alongside text
- AWS deployment with CDK stacks
- GitHub Actions CI/CD pipeline on `main` branch
- Cognito for managed auth and MFA
- S3 + CloudFront for frontend hosting

---

## Session 3: Full-Stack MVP Build

### Backend layer (complete)

**Database models** (`backend/app/models/`)
- `User` -- role-based accounts (patient | nurse | admin), bcrypt-hashed passwords, JWT auth
- `Patient` -- Kanban stage field (`intake | vitals | doc_visit | post_visit`), `stage_order` for column position, JSONB `intake_data` for full form payload
- `Vitals` -- linked to patient, nullable per-field, supports multiple readings
- `PatientAssessment` -- persisted AI triage results (JSONB for nested fields)
- `NurseNote` -- free-text notes with `note_type` (intake | followup | discharge)
- `Staff` -- physicians, nurses, charge nurses, specialists with shift and on-duty flag

**API routers** (`backend/app/routers/`)
- `POST /auth/login` and `POST /auth/register` -- JWT issuance
- `GET /patients` -- all patients sorted by stage/order, filterable by stage
- `PATCH /patients/{id}/stage` -- moves patient between Kanban columns (nurse/admin only)
- `POST /patients/{id}/vitals` -- records new vitals reading
- `POST /triage/assess/{id}` -- triggers Claude assessment and persists result to DB
- `POST /triage/followup/{id}` -- nurse Q&A answered by Claude (plain text)
- `POST /triage/discharge/{id}` -- generates structured discharge summary
- `GET /admin/staff` -- full staff directory
- `GET /admin/metrics` -- per-stage patient counts with capacity utilization %

**Security** (`backend/app/core/security.py`)
- `python-jose` HS256 JWT, 24-hour expiry
- `passlib` bcrypt password hashing
- `require_role(*roles)` dependency factory for route-level RBAC

**Startup** -- FastAPI lifespan handler calls `Base.metadata.create_all` so tables are created on first boot without a migration tool.

**Seed script** (`backend/scripts/seed.py`)
- 3 default users: `admin@hospital.com`, `nurse@hospital.com`, `patient@hospital.com` (passwords match role names + "123")
- 12 staff members across physician, nurse, charge nurse, and specialist roles
- 39 patients with realistic clinical presentations: 20 intake, 10 vitals, 5 doc visit, 4 post visit
- Patients in vitals/doc_visit/post_visit stages have recorded vitals attached
- Idempotent: skips if users table already populated

### Frontend layer (complete)

**Routing** -- React Router v6 with role-based redirect on `/` and `RequireAuth` guard components.

**Auth store** -- Zustand `persist` middleware; token stored in `localStorage` under `auth-storage` key. `apiFetch` reads it on every request.

**Pages**
- `Login.tsx` -- email/password form with one-click demo account buttons (Nurse / Admin / Patient)
- `NurseDashboard.tsx` -- full-screen Kanban board layout
- `PatientIntake.tsx` -- 6-step wizard: personal info, medical history, allergies/medications, next of kin, insurance, consent signature
- `AdminDashboard.tsx` -- ED capacity cards with utilization progress bars + staff directory tables split by physician vs. nursing

**Kanban board** (`KanbanBoard.tsx` + `PatientCard.tsx`)
- `@hello-pangea/dnd` for drag-and-drop; `onDragEnd` fires `PATCH /patients/{id}/stage` and applies optimistic update via `queryClient.setQueryData`
- Columns show capacity badge that turns amber at 70% and red at 90% utilization
- 30-second auto-refetch via TanStack Query `refetchInterval`

**Patient detail drawer** (`PatientDetailDrawer.tsx`)
- Opens on card click as a full-height dialog
- Shows demographics, intake data, latest vitals, and AI assessment
- "Run Assessment" button calls Claude; prior assessments loaded from DB
- "Ask Claude" textarea calls the followup endpoint and renders plain-text response
- Red flags surface in an amber alert block

**shadcn/ui components** written manually: Button, Card, Badge, Input, Label, Textarea, Dialog, Progress, ScrollArea, Separator -- all using Tailwind CSS variables for theming.

### Infrastructure

**`docker-compose.yml`** defines: postgres, redis, qdrant, backend (with `--reload`), frontend (Nginx), and a one-shot `seed` profile service.

Run the full stack:
```bash
docker compose up -d postgres redis qdrant backend
docker compose run --rm seed          # populate DB once
docker compose up -d frontend
```

Or for local development:
```bash
# Terminal 1 -- backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload

# Terminal 2 -- frontend
cd frontend && npm install && npm run dev

# Seed once
cd backend && python -m scripts.seed
```

---

## Rules and Conventions

See `CLAUDE.md` at the project root for AI usage rules, code style, and authorship policy.
See `PRODUCT_SPEC.md` for the full product description and AWS architecture plan.

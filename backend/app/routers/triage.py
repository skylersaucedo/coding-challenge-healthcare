import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_role
from app.db.session import get_db
from app.models.patient import NurseNote, Patient, PatientAssessment, Vitals
from app.services.triage import (
    DischargeSummary,
    TriageAssessment,
    assess_patient_triage,
    generate_discharge_summary,
    symptom_followup,
)

router = APIRouter(prefix="/triage", tags=["triage"])


class FollowUpRequest(BaseModel):
    nurse_question: str


class DischargeRequest(BaseModel):
    visit_notes: str


async def _get_patient_or_404(patient_id: uuid.UUID, db: AsyncSession) -> Patient:
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


async def _load_latest_assessment(
    patient_id: uuid.UUID, db: AsyncSession
) -> TriageAssessment | None:
    result = await db.execute(
        select(PatientAssessment)
        .where(PatientAssessment.patient_id == patient_id)
        .order_by(PatientAssessment.assessed_at.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if not row:
        return None
    return TriageAssessment(
        urgency=row.urgency,
        escalate_or_redirect=row.escalate_or_redirect,
        confidence=row.confidence,
        recommended_actions=row.recommended_actions,
        rationale=row.rationale,
        red_flags=row.red_flags,
        missing_fields=row.missing_fields,
        follow_up_checklist=row.follow_up_checklist,
    )


async def _build_patient_dict(patient: Patient, db: AsyncSession) -> dict:
    base = {
        "id": str(patient.id),
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "date_of_birth": patient.date_of_birth,
        "gender": patient.gender,
        "chief_complaint": patient.chief_complaint,
        "arrival_time": patient.created_at.isoformat(),
        "current_stage": patient.stage,
        **(patient.intake_data or {}),
    }

    vitals_row = await db.execute(
        select(Vitals)
        .where(Vitals.patient_id == patient.id)
        .order_by(Vitals.recorded_at.desc())
        .limit(1)
    )
    vitals = vitals_row.scalar_one_or_none()
    if vitals:
        base["vitals"] = {
            "heart_rate": vitals.heart_rate,
            "blood_pressure": f"{vitals.blood_pressure_systolic}/{vitals.blood_pressure_diastolic}"
            if vitals.blood_pressure_systolic
            else None,
            "temperature_f": vitals.temperature,
            "respiratory_rate": vitals.respiratory_rate,
            "oxygen_saturation": vitals.oxygen_saturation,
        }

    notes_rows = await db.execute(
        select(NurseNote.content, NurseNote.note_type, NurseNote.created_at)
        .where(NurseNote.patient_id == patient.id)
        .order_by(NurseNote.created_at.asc())
    )
    notes = notes_rows.all()
    if notes:
        base["nurse_notes"] = [
            {"type": n.note_type, "content": n.content, "at": n.created_at.isoformat()}
            for n in notes
        ]

    return base


@router.post("/assess/{patient_id}", response_model=TriageAssessment)
async def assess(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("nurse", "admin")),
):
    patient = await _get_patient_or_404(patient_id, db)
    assessment = await assess_patient_triage(await _build_patient_dict(patient, db))

    db.add(
        PatientAssessment(
            patient_id=patient_id,
            urgency=assessment.urgency,
            escalate_or_redirect=assessment.escalate_or_redirect,
            confidence=assessment.confidence,
            recommended_actions=assessment.recommended_actions.model_dump(),
            rationale=assessment.rationale,
            red_flags=assessment.red_flags,
            missing_fields=assessment.missing_fields,
            follow_up_checklist=[i.model_dump() for i in assessment.follow_up_checklist],
        )
    )
    await db.commit()
    return assessment


@router.post("/followup/{patient_id}")
async def followup(
    patient_id: uuid.UUID,
    body: FollowUpRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("nurse", "admin")),
):
    patient = await _get_patient_or_404(patient_id, db)
    prior = await _load_latest_assessment(patient_id, db)
    answer = await symptom_followup(await _build_patient_dict(patient, db), body.nurse_question, prior)
    return {"answer": answer}


@router.post("/discharge/{patient_id}", response_model=DischargeSummary)
async def discharge(
    patient_id: uuid.UUID,
    body: DischargeRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("nurse", "admin")),
):
    patient = await _get_patient_or_404(patient_id, db)
    prior = await _load_latest_assessment(patient_id, db)
    return await generate_discharge_summary(await _build_patient_dict(patient, db), body.visit_notes, prior)


@router.get("/assessments/{patient_id}", response_model=list[dict])
async def get_assessments(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("nurse", "admin")),
):
    result = await db.execute(
        select(PatientAssessment)
        .where(PatientAssessment.patient_id == patient_id)
        .order_by(PatientAssessment.assessed_at.desc())
    )
    rows = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "urgency": r.urgency,
            "escalate_or_redirect": r.escalate_or_redirect,
            "confidence": r.confidence,
            "rationale": r.rationale,
            "red_flags": r.red_flags,
            "recommended_actions": r.recommended_actions,
            "follow_up_checklist": r.follow_up_checklist,
            "assessed_at": r.assessed_at.isoformat(),
        }
        for r in rows
    ]

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_role
from app.db.session import get_db
from app.models.patient import Patient, PatientAssessment, Vitals
from app.schemas.patient import (
    IntakeFormIn,
    PatientOut,
    PatientStageUpdate,
    VitalsIn,
    VitalsOut,
)

router = APIRouter(prefix="/patients", tags=["patients"])

VALID_STAGES = {"intake", "vitals", "doc_visit", "post_visit"}


@router.get("", response_model=list[PatientOut])
async def list_patients(
    stage: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("nurse", "admin")),
):
    q = select(Patient).order_by(Patient.stage, Patient.stage_order)
    if stage:
        q = q.where(Patient.stage == stage)
    result = await db.execute(q)
    patients = result.scalars().all()

    urgency_map: dict = {}
    if patients:
        ids = [p.id for p in patients]
        rows = await db.execute(
            select(PatientAssessment.patient_id, PatientAssessment.urgency)
            .where(PatientAssessment.patient_id.in_(ids))
            .distinct(PatientAssessment.patient_id)
            .order_by(PatientAssessment.patient_id, PatientAssessment.assessed_at.desc())
        )
        urgency_map = {row.patient_id: row.urgency for row in rows}

    return [
        PatientOut.model_validate(p).model_copy(update={"urgency": urgency_map.get(p.id)})
        for p in patients
    ]


@router.get("/{patient_id}", response_model=PatientOut)
async def get_patient(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if current_user.role == "patient" and patient.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return patient


@router.post("", response_model=PatientOut, status_code=201)
async def create_patient(
    body: IntakeFormIn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    intake_data = body.model_dump(
        exclude={"first_name", "last_name", "date_of_birth", "gender", "chief_complaint"}
    )
    patient = Patient(
        user_id=current_user.id if current_user.role == "patient" else None,
        first_name=body.first_name,
        last_name=body.last_name,
        date_of_birth=body.date_of_birth,
        gender=body.gender,
        chief_complaint=body.chief_complaint,
        stage="intake",
        stage_order=0,
        intake_data=intake_data,
    )
    db.add(patient)
    await db.commit()
    await db.refresh(patient)
    return patient


@router.patch("/{patient_id}/stage", response_model=PatientOut)
async def update_stage(
    patient_id: uuid.UUID,
    body: PatientStageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("nurse", "admin")),
):
    if body.stage not in VALID_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage: {body.stage}")

    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient.stage = body.stage
    patient.stage_order = body.stage_order
    await db.commit()
    await db.refresh(patient)
    return patient


@router.post("/{patient_id}/vitals", response_model=VitalsOut, status_code=201)
async def record_vitals(
    patient_id: uuid.UUID,
    body: VitalsIn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("nurse", "admin")),
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Patient not found")

    vitals = Vitals(patient_id=patient_id, recorded_by=current_user.id, **body.model_dump())
    db.add(vitals)
    await db.commit()
    await db.refresh(vitals)
    return vitals


@router.get("/{patient_id}/vitals", response_model=list[VitalsOut])
async def get_vitals(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("nurse", "admin")),
):
    result = await db.execute(
        select(Vitals)
        .where(Vitals.patient_id == patient_id)
        .order_by(Vitals.recorded_at.desc())
    )
    return result.scalars().all()

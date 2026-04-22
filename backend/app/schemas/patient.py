from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class VitalsIn(BaseModel):
    heart_rate: int | None = None
    blood_pressure_systolic: int | None = None
    blood_pressure_diastolic: int | None = None
    temperature: float | None = None
    respiratory_rate: int | None = None
    oxygen_saturation: float | None = None


class VitalsOut(VitalsIn):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    recorded_at: datetime


class IntakeFormIn(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: str
    gender: str
    chief_complaint: str
    medical_history: list[str] = []
    allergies: list[str] = []
    current_medications: list[str] = []
    next_of_kin: dict[str, Any] = {}
    insurance: dict[str, Any] = {}
    consent_signed: bool = False


class PatientStageUpdate(BaseModel):
    stage: str
    stage_order: int


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    last_name: str
    date_of_birth: str | None
    gender: str | None
    chief_complaint: str
    stage: str
    stage_order: int
    intake_data: dict[str, Any] | None
    created_at: datetime
    urgency: str | None = None

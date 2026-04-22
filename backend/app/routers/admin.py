from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_role
from app.db.session import get_db
from app.models.patient import Patient
from app.models.staff import Staff
from app.schemas.staff import StaffOut

router = APIRouter(prefix="/admin", tags=["admin"])

STAGE_CAPACITY = {
    "intake": 20,
    "vitals": 10,
    "doc_visit": 5,
    "post_visit": 4,
}


@router.get("/staff", response_model=list[StaffOut])
async def list_staff(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "nurse")),
):
    result = await db.execute(
        select(Staff).order_by(Staff.role, Staff.last_name)
    )
    return result.scalars().all()


@router.get("/metrics")
async def get_metrics(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "nurse")),
):
    result = await db.execute(
        select(Patient.stage, func.count(Patient.id).label("count")).group_by(Patient.stage)
    )
    counts = {row.stage: row.count for row in result}

    stages = [
        {
            "stage": stage,
            "label": stage.replace("_", " ").title(),
            "count": counts.get(stage, 0),
            "capacity": capacity,
            "utilization": round(counts.get(stage, 0) / capacity * 100, 1),
        }
        for stage, capacity in STAGE_CAPACITY.items()
    ]
    return {"stages": stages, "total_patients": sum(counts.values())}

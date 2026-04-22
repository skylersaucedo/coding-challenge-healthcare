from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class StaffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    last_name: str
    role: str
    specialty: str | None
    department: str
    shift: str
    is_on_duty: bool
    created_at: datetime

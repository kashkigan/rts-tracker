from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class PrescriptionCreate(BaseModel):
    patient_external_id: str = Field(..., description="Internal pharmacy patient id")
    patient_name: str
    rx_number: str
    medication_name: str
    canceled_at: datetime
    cancel_note: Optional[str] = None

    is_antibiotic: bool = False
    is_waiter: bool = False
    is_fridge_item: bool = False
    is_narcotic: bool = False
    is_central_fill: bool = False
    is_regular_med: bool = False


class CallLogCreate(BaseModel):
    outcome: Literal["called", "left_message", "no_answer"]
    note: Optional[str] = None
    called_at: Optional[datetime] = None

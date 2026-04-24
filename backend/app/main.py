from datetime import date, datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, Query
from supabase import Client, create_client

from .config import settings
from .models import CallLogCreate, PrescriptionCreate

app = FastAPI(title="RTS Tracker API", version="0.1.0")


def get_supabase() -> Client:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(status_code=500, detail="Supabase env vars are not configured")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/prescriptions")
def create_prescription(payload: PrescriptionCreate) -> dict:
    db = get_supabase()

    patient_result = (
        db.table("patients")
        .upsert(
            {
                "external_id": payload.patient_external_id,
                "full_name": payload.patient_name,
            },
            on_conflict="external_id",
        )
        .execute()
    )

    patient = patient_result.data[0]
    pull_due_date = (payload.canceled_at + timedelta(days=14)).date().isoformat()

    row = {
        "patient_id": patient["id"],
        "rx_number": payload.rx_number,
        "medication_name": payload.medication_name,
        "status": "canceled",
        "canceled_at": payload.canceled_at.isoformat(),
        "pull_due_date": pull_due_date,
        "cancel_note": payload.cancel_note,
        "is_antibiotic": payload.is_antibiotic,
        "is_waiter": payload.is_waiter,
        "is_fridge_item": payload.is_fridge_item,
        "is_narcotic": payload.is_narcotic,
        "is_central_fill": payload.is_central_fill,
    }

    insert_result = db.table("prescriptions").insert(row).execute()
    return {"prescription": insert_result.data[0]}


@app.get("/prescriptions/pull-queue")
def get_pull_queue(for_date: date = Query(default_factory=date.today)) -> dict:
    db = get_supabase()
    result = (
        db.table("prescriptions")
        .select("id,rx_number,medication_name,pull_due_date,patients(full_name)")
        .eq("status", "canceled")
        .lte("pull_due_date", for_date.isoformat())
        .order("pull_due_date")
        .execute()
    )

    items = [
        {
            "prescription_id": row["id"],
            "patient_name": row["patients"]["full_name"],
            "rx_number": row["rx_number"],
            "medication_name": row["medication_name"],
            "pull_due_date": row["pull_due_date"],
        }
        for row in result.data
    ]
    return {"items": items}


@app.post("/prescriptions/{prescription_id}/call")
def log_call(prescription_id: str, payload: CallLogCreate) -> dict:
    db = get_supabase()
    called_at = payload.called_at or datetime.now(timezone.utc)

    call_result = (
        db.table("call_logs")
        .insert(
            {
                "prescription_id": prescription_id,
                "outcome": payload.outcome,
                "note": payload.note,
                "called_at": called_at.isoformat(),
            }
        )
        .execute()
    )
    return {"call_log": call_result.data[0]}


@app.get("/reports/weekly")
def weekly_report(reference_date: date = Query(default_factory=date.today)) -> dict:
    db = get_supabase()

    week_start = reference_date - timedelta(days=reference_date.weekday())
    week_end = week_start + timedelta(days=6)

    rows = (
        db.table("prescriptions")
        .select(
            "id,is_antibiotic,is_waiter,is_fridge_item,is_narcotic,is_central_fill,canceled_at"
        )
        .gte("canceled_at", week_start.isoformat())
        .lte("canceled_at", f"{week_end.isoformat()}T23:59:59")
        .execute()
        .data
    )

    summary = {
        "week_start": week_start,
        "week_end": week_end,
        "total_canceled": len(rows),
        "antibiotics": sum(1 for row in rows if row["is_antibiotic"]),
        "waiters": sum(1 for row in rows if row["is_waiter"]),
        "fridge_items": sum(1 for row in rows if row["is_fridge_item"]),
        "narcotics": sum(1 for row in rows if row["is_narcotic"]),
        "central_fill": sum(1 for row in rows if row["is_central_fill"]),
    }
    return {"summary": summary}

from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from supabase import Client, create_client

from .config import settings
from .models import CallLogCreate, PrescriptionCreate

app = FastAPI(title="RTS Tracker API", version="0.2.0")

Period = Literal["week", "month", "3m", "6m"]


def get_supabase() -> Client:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(status_code=500, detail="Supabase env vars are not configured")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_period_bounds(reference_date: date, period: Period) -> tuple[date, date]:
    if period == "week":
        start = reference_date - timedelta(days=reference_date.weekday())
    elif period == "month":
        start = reference_date.replace(day=1)
    elif period == "3m":
        start = reference_date - timedelta(days=90)
    else:
        start = reference_date - timedelta(days=180)
    return start, reference_date


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
        "is_regular_med": payload.is_regular_med,
    }

    insert_result = db.table("prescriptions").insert(row).execute()
    return {"prescription": insert_result.data[0]}


@app.get("/prescriptions")
def list_prescriptions(
    period: Period = Query(default="week"), reference_date: date = Query(default_factory=date.today)
) -> dict:
    db = get_supabase()
    start_date, end_date = get_period_bounds(reference_date, period)

    result = (
        db.table("prescriptions")
        .select("id,rx_number,medication_name,status,canceled_at,pull_due_date,patients(full_name)")
        .gte("canceled_at", start_date.isoformat())
        .lte("canceled_at", f"{end_date.isoformat()}T23:59:59")
        .order("canceled_at", desc=True)
        .execute()
    )

    entries = [
        {
            "prescription_id": row["id"],
            "patient_name": row["patients"]["full_name"],
            "rx_number": row["rx_number"],
            "medication_name": row["medication_name"],
            "status": row["status"],
            "canceled_at": row["canceled_at"],
            "pull_due_date": row["pull_due_date"],
        }
        for row in result.data
    ]
    return {"entries": entries, "start_date": start_date, "end_date": end_date}


@app.delete("/prescriptions/{prescription_id}")
def delete_prescription(prescription_id: str) -> dict:
    db = get_supabase()
    db.table("prescriptions").delete().eq("id", prescription_id).execute()
    return {"deleted": True, "prescription_id": prescription_id}


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


@app.get("/reports/dashboard")
def dashboard_report(
    period: Period = Query(default="week"), reference_date: date = Query(default_factory=date.today)
) -> dict:
    db = get_supabase()
    start_date, end_date = get_period_bounds(reference_date, period)

    scripts = (
        db.table("prescriptions")
        .select(
            "id,status,is_antibiotic,is_waiter,is_fridge_item,is_narcotic,is_central_fill,is_regular_med,canceled_at"
        )
        .gte("canceled_at", start_date.isoformat())
        .lte("canceled_at", f"{end_date.isoformat()}T23:59:59")
        .execute()
        .data
    )

    calls = (
        db.table("call_logs")
        .select("prescription_id, outcome, called_at")
        .gte("called_at", start_date.isoformat())
        .lte("called_at", f"{end_date.isoformat()}T23:59:59")
        .execute()
        .data
    )

    called_unique = {row["prescription_id"] for row in calls}
    status_counts = {
        "canceled": sum(1 for row in scripts if row["status"] == "canceled"),
        "pulled": sum(1 for row in scripts if row["status"] == "pulled"),
        "returned_to_stock": sum(1 for row in scripts if row["status"] == "returned_to_stock"),
    }

    summary = {
        "period": period,
        "start_date": start_date,
        "end_date": end_date,
        "total_cancelled": len(scripts),
        "total_scripts_called": len(called_unique),
        "antibiotics": sum(1 for row in scripts if row["is_antibiotic"]),
        "waiters": sum(1 for row in scripts if row["is_waiter"]),
        "fridge_items": sum(1 for row in scripts if row["is_fridge_item"]),
        "narcotics": sum(1 for row in scripts if row["is_narcotic"]),
        "central_fill": sum(1 for row in scripts if row["is_central_fill"]),
        "regular_meds": sum(1 for row in scripts if row["is_regular_med"]),
        "status_counts": status_counts,
        "call_outcomes": {
            "called": sum(1 for row in calls if row["outcome"] == "called"),
            "left_message": sum(1 for row in calls if row["outcome"] == "left_message"),
            "no_answer": sum(1 for row in calls if row["outcome"] == "no_answer"),
        },
    }
    return {"summary": summary}

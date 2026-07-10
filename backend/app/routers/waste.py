from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, date
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user
from app.calculations import get_waste_limit, is_waste_alert

router = APIRouter(prefix="/api/waste", tags=["Waste Monitoring"])


@router.post("/log", response_model=schemas.WasteLogOut, status_code=201)
def create_waste_log(
    data: schemas.WasteLogCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    limit   = get_waste_limit(data.process_stage)
    alert   = is_waste_alert(data.process_stage, data.actual_waste_pct)
    waste_kg = data.input_material_kg * data.actual_waste_pct / 100

    log = models.WasteLog(
        log_date          = data.log_date,
        shift             = data.shift,
        process_stage     = data.process_stage,
        yarn_count_id     = data.yarn_count_id,
        input_material_kg = data.input_material_kg,
        actual_waste_pct  = data.actual_waste_pct,
        waste_kg          = round(waste_kg, 2),
        normal_limit_pct  = limit,
        is_alert          = alert,
        remarks           = data.remarks,
        logged_by         = user.id,
    )
    db.add(log); db.commit(); db.refresh(log)
    return log


@router.get("/logs", response_model=List[schemas.WasteLogOut])
def list_waste_logs(
    from_date:    Optional[date] = Query(None),
    to_date:      Optional[date] = Query(None),
    process_stage: Optional[str] = Query(None),
    shift:        Optional[str]  = Query(None),
    alerts_only:  bool           = Query(False),
    limit:        int            = Query(100),
    db: Session = Depends(get_db),
    _user = Depends(get_current_user),
):
    q = db.query(models.WasteLog)
    if from_date:  q = q.filter(models.WasteLog.log_date >= datetime.combine(from_date, datetime.min.time()))
    if to_date:    q = q.filter(models.WasteLog.log_date <= datetime.combine(to_date, datetime.max.time()))
    if process_stage: q = q.filter(models.WasteLog.process_stage == process_stage)
    if shift:      q = q.filter(models.WasteLog.shift == shift)
    if alerts_only: q = q.filter(models.WasteLog.is_alert == True)
    return q.order_by(models.WasteLog.log_date.desc()).limit(limit).all()


@router.get("/summary", response_model=schemas.WasteSummaryResponse)
def waste_summary(
    from_date: Optional[date] = Query(None),
    to_date:   Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _user = Depends(get_current_user),
):
    q = db.query(models.WasteLog)
    if from_date: q = q.filter(models.WasteLog.log_date >= datetime.combine(from_date, datetime.min.time()))
    if to_date:   q = q.filter(models.WasteLog.log_date <= datetime.combine(to_date, datetime.max.time()))

    logs = q.all()
    if not logs:
        return schemas.WasteSummaryResponse(total_entries=0, avg_waste_pct=0, total_waste_kg=0, alert_count=0, by_stage={})

    total_entries = len(logs)
    avg_waste     = sum(l.actual_waste_pct for l in logs) / total_entries
    total_kg      = sum(l.waste_kg or 0 for l in logs)
    alerts        = sum(1 for l in logs if l.is_alert)

    by_stage = {}
    for log in logs:
        if log.process_stage not in by_stage:
            by_stage[log.process_stage] = {"count": 0, "total_pct": 0, "alerts": 0, "limit": get_waste_limit(log.process_stage)}
        by_stage[log.process_stage]["count"]     += 1
        by_stage[log.process_stage]["total_pct"] += log.actual_waste_pct
        if log.is_alert:
            by_stage[log.process_stage]["alerts"] += 1

    for stage in by_stage:
        by_stage[stage]["avg_pct"] = round(by_stage[stage]["total_pct"] / by_stage[stage]["count"], 2)

    return schemas.WasteSummaryResponse(
        total_entries = total_entries,
        avg_waste_pct = round(avg_waste, 2),
        total_waste_kg = round(total_kg, 2),
        alert_count   = alerts,
        by_stage      = by_stage,
    )


@router.get("/alerts")
def get_alerts(db: Session = Depends(get_db), _user = Depends(get_current_user)):
    """Latest 20 unresolved waste alerts."""
    alerts = (
        db.query(models.WasteLog)
        .filter(models.WasteLog.is_alert == True)
        .order_by(models.WasteLog.log_date.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id":           a.id,
            "stage":        a.process_stage,
            "shift":        a.shift,
            "date":         str(a.log_date),
            "actual_pct":   a.actual_waste_pct,
            "limit_pct":    a.normal_limit_pct,
            "excess_pct":   round(a.actual_waste_pct - (a.normal_limit_pct or 0), 2),
        }
        for a in alerts
    ]

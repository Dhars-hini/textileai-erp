from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user
from app.calculations import calculate_spinning

router = APIRouter(prefix="/api/production", tags=["Production"])


# ── Yarn Count CRUD ────────────────────────────────────────
@router.get("/yarn-counts", response_model=List[schemas.YarnCountOut])
def list_yarn_counts(db: Session = Depends(get_db)):
    return db.query(models.YarnCount).filter(models.YarnCount.is_active == True).all()


@router.post("/yarn-counts", response_model=schemas.YarnCountOut, status_code=201)
def create_yarn_count(
    data: schemas.YarnCountCreate,
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    if db.query(models.YarnCount).filter(models.YarnCount.count_label == data.count_label).first():
        raise HTTPException(400, "Count label already exists")
    obj = models.YarnCount(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj


@router.put("/yarn-counts/{count_id}", response_model=schemas.YarnCountOut)
def update_yarn_count(
    count_id: int,
    data: schemas.YarnCountCreate,
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    obj = db.query(models.YarnCount).filter(models.YarnCount.id == count_id).first()
    if not obj:
        raise HTTPException(404, "Yarn count not found")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return obj


@router.delete("/yarn-counts/{count_id}", status_code=204)
def delete_yarn_count(
    count_id: int,
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    obj = db.query(models.YarnCount).filter(models.YarnCount.id == count_id).first()
    if not obj: raise HTTPException(404, "Not found")
    obj.is_active = False          # soft delete
    db.commit()


# ── Quick Calculate (no DB save) ──────────────────────────
@router.post("/calculate", response_model=schemas.QuickCalcResponse)
def quick_calculate(req: schemas.QuickCalcRequest):
    """
    Instant calculation using Excel formulas.
    No auth required — used by frontend calculator.
    """
    return calculate_spinning(req)


# ── Production Plans ──────────────────────────────────────
@router.get("/plans", response_model=List[schemas.PlanOut])
def list_plans(
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    return db.query(models.ProductionPlan).order_by(models.ProductionPlan.plan_date.desc()).all()


@router.post("/plans", response_model=schemas.PlanOut, status_code=201)
def create_plan(
    plan_in: schemas.PlanCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    plan = models.ProductionPlan(
        plan_date  = plan_in.plan_date,
        plan_name  = plan_in.plan_name,
        notes      = plan_in.notes,
        created_by = user.id,
    )
    db.add(plan); db.flush()   # get plan.id before adding entries

    for entry_in in plan_in.entries:
        # Fetch yarn count defaults for missing fields
        yc = db.query(models.YarnCount).filter(models.YarnCount.id == entry_in.yarn_count_id).first()
        if not yc:
            raise HTTPException(404, f"Yarn count id {entry_in.yarn_count_id} not found")

        calc_req = schemas.QuickCalcRequest(
            production_target_kg = entry_in.production_target_kg,
            nominal_count        = yc.nominal_count,
            spindle_speed        = entry_in.spindle_speed or yc.spindle_speed,
            tpi                  = yc.tpi,
            efficiency_pct       = entry_in.efficiency_pct or yc.efficiency_pct,
            spindles_per_machine = yc.spindles_per_machine,
            waste_pct            = entry_in.waste_pct or yc.spinning_waste_pct,
        )
        calc = calculate_spinning(calc_req)

        entry = models.ProductionEntry(
            plan_id               = plan.id,
            yarn_count_id         = entry_in.yarn_count_id,
            production_target_kg  = entry_in.production_target_kg,
            spindle_speed         = calc_req.spindle_speed,
            efficiency_pct        = calc_req.efficiency_pct,
            waste_pct             = calc_req.waste_pct,
            twist_multiplier      = calc.twist_multiplier,
            prod_per_spl_8hr_gms  = calc.prod_per_spl_8hr_gms,
            prod_per_spl_24hr_gms = calc.prod_per_spl_24hr_gms,
            prod_per_frame_day_kg = calc.prod_per_frame_day_kg,
            spindles_required     = calc.spindles_required,
            frames_required       = calc.frames_required,
            output_with_waste_kg  = calc.output_with_waste_kg,
            yarn_bags_per_day     = calc.yarn_bags_per_day,
            yarn_bags_per_month   = calc.yarn_bags_per_month,
            bales_per_day         = calc.bales_per_day,
            total_mixing_kg       = calc.total_mixing_kg,
        )
        db.add(entry)

    db.commit(); db.refresh(plan)
    return plan


@router.get("/plans/{plan_id}", response_model=schemas.PlanOut)
def get_plan(plan_id: int, db: Session = Depends(get_db), _user = Depends(get_current_user)):
    plan = db.query(models.ProductionPlan).filter(models.ProductionPlan.id == plan_id).first()
    if not plan: raise HTTPException(404, "Plan not found")
    return plan


@router.delete("/plans/{plan_id}", status_code=204)
def delete_plan(plan_id: int, db: Session = Depends(get_db), _user = Depends(get_current_user)):
    plan = db.query(models.ProductionPlan).filter(models.ProductionPlan.id == plan_id).first()
    if not plan: raise HTTPException(404, "Plan not found")
    db.delete(plan); db.commit()
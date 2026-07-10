"""
app/routers/prediction.py
══════════════════════════════════════════════════════════════════
All AI prediction endpoints:

POST /api/prediction/production      → predict production kg/day
POST /api/prediction/waste           → predict waste % for a stage
GET  /api/prediction/forecast/7day   → 7-day production forecast
GET  /api/prediction/forecast/stages → waste forecast all 7 stages
GET  /api/prediction/history         → past predictions from DB
GET  /api/prediction/model-info      → accuracy, training date

POST /api/prediction/auto-log        → generate one shift auto log
POST /api/prediction/generate-history→ generate N days history
POST /api/prediction/train           → trigger model training
══════════════════════════════════════════════════════════════════
"""

import json, math
from fastapi  import APIRouter, Depends, BackgroundTasks, Query
from sqlalchemy.orm import Session
from app.database   import get_db
from app import models, schemas
from app.auth       import get_current_user

router = APIRouter(prefix="/api/prediction", tags=["AI Prediction"])


# ── Rule-based fallbacks ────────────────────────────────────────────

def _rule_production(req):
    ss, eff, waste = req.spindle_speed, req.efficiency_pct / 100, req.waste_pct / 100
    hrs, nc        = req.shift_hours, req.nominal_count
    tpi            = 3.6
    base = (ss * eff * hrs * 60) / (tpi * 39.37 * 453.59) * 1008 / 1000
    cf   = 1.15 if nc < 30 else (1.0 if nc < 40 else 0.88)
    pred = base * cf * (1 - waste)
    return {
        "predicted_value": round(pred, 1),
        "confidence_pct":  88.5,
        "lower_bound":     round(pred * 0.95, 1),
        "upper_bound":     round(pred * 1.05, 1),
        "model_version":   "v1.0-rule-based",
        "trend":           "stable",
        "alert":           False,
        "message":         "Physics-based calculation (train ML model for higher accuracy)",
    }


def _rule_waste(req):
    base = 3.25
    if req.spindle_speed > 21000: base += 0.3
    if req.efficiency_pct < 95:   base += (95 - req.efficiency_pct) * 0.08
    if req.humidity_pct   > 65:   base += (req.humidity_pct - 65)  * 0.05
    if req.temperature_c  > 35:   base += (req.temperature_c - 35) * 0.07
    trend = "increase" if base > 3.5 else ("decrease" if base < 3.0 else "stable")
    msgs  = {
        "increase": "⚠ Waste likely to rise. Check humidity and machine speed.",
        "decrease": "✓ Conditions are favourable. Waste should stay low.",
        "stable":   "→ Waste expected within normal limits.",
    }
    return {
        "predicted_value": round(base, 2),
        "confidence_pct":  85.0,
        "lower_bound":     round(base * 0.92, 2),
        "upper_bound":     round(base * 1.08, 2),
        "model_version":   "v1.0-rule-based",
        "trend":           trend,
        "alert":           base > 4.0,
        "message":         msgs[trend],
    }


# ── Core predictions ────────────────────────────────────────────────

@router.post("/production", response_model=schemas.PredictionResponse)
def predict_production(
    req:  schemas.ProductionPredictRequest,
    db:   Session       = Depends(get_db),
    user: models.User   = Depends(get_current_user),
):
    try:
        from app.ml_model import predict_production_ml
        result = predict_production_ml(req)
    except Exception:
        result = _rule_production(req)

    db.add(models.PredictionLog(
        prediction_type = "production",
        input_features  = json.dumps(req.model_dump()),
        predicted_value = result["predicted_value"],
        confidence_pct  = result["confidence_pct"],
        lower_bound     = result["lower_bound"],
        upper_bound     = result["upper_bound"],
        model_version   = result["model_version"],
        predicted_by    = user.id,
    ))
    db.commit()
    return result


@router.post("/waste", response_model=schemas.PredictionResponse)
def predict_waste(
    req:  schemas.WastePredictRequest,
    db:   Session       = Depends(get_db),
    user: models.User   = Depends(get_current_user),
):
    try:
        from app.ml_model import predict_waste_ml
        result = predict_waste_ml(req)
    except Exception:
        result = _rule_waste(req)

    db.add(models.PredictionLog(
        prediction_type = "waste",
        input_features  = json.dumps(req.model_dump()),
        predicted_value = result["predicted_value"],
        confidence_pct  = result["confidence_pct"],
        lower_bound     = result["lower_bound"],
        upper_bound     = result["upper_bound"],
        model_version   = result["model_version"][:20] if result["model_version"] else "v1.0",
        predicted_by    = user.id,
    ))
    db.commit()
    return result


# ── Forecasts ───────────────────────────────────────────────────────

@router.get("/forecast/7day")
def forecast_7day(
    spindle_speed:  float = Query(20000),
    efficiency_pct: float = Query(98),
    waste_pct:      float = Query(3.25),
    user: models.User     = Depends(get_current_user),
):
    try:
        from app.ml_model import forecast_7day as _f7
        return {"forecast": _f7(spindle_speed, efficiency_pct, waste_pct), "model": "ML"}
    except Exception:
        # Physics fallback
        from datetime import datetime, timedelta
        import random
        result = []
        for i in range(7):
            tpi  = 3.6
            prod = (spindle_speed * (efficiency_pct/100) * 24*60) / (tpi*39.37*453.59) * 1008/1000 * 28
            prod *= (1 - waste_pct/100) * (1 + random.gauss(0, 0.015))
            dt   = datetime.now() + timedelta(days=i)
            result.append({
                "day": i+1, "date": dt.strftime("%a %d %b"),
                "predicted_kg": round(prod, 0),
                "lower": round(prod*0.95, 0), "upper": round(prod*1.05, 0),
                "is_today": i == 0,
            })
        return {"forecast": result, "model": "rule-based"}


@router.get("/forecast/stages")
def forecast_stages(
    temperature_c:  float = Query(30),
    humidity_pct:   float = Query(60),
    spindle_speed:  float = Query(20000),
    efficiency_pct: float = Query(98),
    user: models.User     = Depends(get_current_user),
):
    try:
        from app.ml_model import get_waste_forecast_by_stage
        return {
            "stages": get_waste_forecast_by_stage(temperature_c, humidity_pct, spindle_speed, efficiency_pct),
            "conditions": {"temp": temperature_c, "humidity": humidity_pct, "speed": spindle_speed, "efficiency": efficiency_pct},
            "model": "ML",
        }
    except Exception:
        # Fallback
        STAGES = {"Blowroom":1.2,"Carding":4.5,"Combing":14.0,"Drawing":0.5,"Roving":0.8,"Spinning":3.25,"Winding":0.5}
        BASE   = {"Blowroom":1.05,"Carding":3.9,"Combing":12.8,"Drawing":0.32,"Roving":0.52,"Spinning":2.85,"Winding":0.33}
        result = []
        for stage, limit in STAGES.items():
            pred = BASE[stage] + (temperature_c-30)*0.04 + (humidity_pct-60)*0.03
            pred = max(0.05, round(pred, 2))
            result.append({"stage":stage,"predicted":pred,"limit":limit,"alert":pred>limit,"pct_of_limit":round(pred/limit*100,1)})
        return {"stages": result, "conditions": {"temp":temperature_c,"humidity":humidity_pct}, "model": "rule-based"}


# ── Auto log generation ─────────────────────────────────────────────

@router.post("/auto-log")
def auto_log_shift(
    shift: str        = Query(None, description="Shift A | Shift B | Shift C"),
    db:    Session    = Depends(get_db),
    user:  models.User = Depends(get_current_user),
):
    """Generate one shift's waste logs automatically and save to DB."""
    from app.auto_logger import generate_shift_log
    count = generate_shift_log(shift=shift, verbose=False)
    return {"status": "ok", "entries_created": count, "shift": shift or "auto-detected"}


@router.post("/generate-history")
def generate_history(
    days: int         = Query(30, ge=1, le=365),
    db:   Session     = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Generate N days of historical waste logs for ML training."""
    from app.auto_logger import generate_history as _gh
    count = _gh(days=days, verbose=False)
    return {"status": "ok", "entries_created": count, "days": days}


@router.post("/train")
def train_model(
    background_tasks: BackgroundTasks,
    user: models.User = Depends(get_current_user),
):
    """Trigger ML model training in background."""
    def _train():
        import subprocess, sys, os
        # Get the backend root directory (where train_model.py lives)
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        train_script = os.path.join(backend_dir, "train_model.py")
        result = subprocess.run(
            [sys.executable, train_script],
            capture_output=True,
            text=True,
            cwd=backend_dir
        )
        print("TRAIN STDOUT:", result.stdout)
        print("TRAIN STDERR:", result.stderr)

    background_tasks.add_task(_train)
    return {"status": "training_started", "message": "Training started. Wait 20 seconds then click Refresh."}

# ── Model info & history ────────────────────────────────────────────

@router.get("/model-info")
def model_info(user: models.User = Depends(get_current_user)):
    """Return model training metadata — accuracy, date, samples."""
    try:
        from app.ml_model import get_model_meta
        meta = get_model_meta()
        if not meta:
            return {"status": "not_trained", "message": "No trained model found. Generate history then train."}
        return {"status": "trained", **meta}
    except Exception as e:
        return {"status": "not_trained", "error": str(e)}


@router.get("/history")
def prediction_history(
    limit: int        = 50,
    db:    Session    = Depends(get_db),
    user:  models.User = Depends(get_current_user),
):
    logs = (
        db.query(models.PredictionLog)
        .order_by(models.PredictionLog.predicted_at.desc())
        .limit(limit).all()
    )
    return [
        {"id": l.id, "type": l.prediction_type, "predicted": l.predicted_value,
         "confidence": l.confidence_pct, "model_version": l.model_version,
         "predicted_at": str(l.predicted_at)}
        for l in logs
    ]

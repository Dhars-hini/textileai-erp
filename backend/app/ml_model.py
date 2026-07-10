"""
app/ml_model.py
══════════════════════════════════════════════════════════════════
Loads trained .pkl models and provides prediction functions.
Falls back to rule-based physics if models not found.

Called by: app/routers/prediction.py
══════════════════════════════════════════════════════════════════
"""

import os, json, math
import joblib
import numpy as np

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models_trained")
STAGES    = ["Blowroom","Carding","Combing","Drawing","Roving","Spinning","Winding"]
STAGE_IDX = {s: i for i, s in enumerate(STAGES)}

_cache = {}   # cache loaded models in memory

def _load(name: str):
    """Load and cache a .pkl file."""
    if name not in _cache:
        path = os.path.join(MODEL_DIR, name)
        if not os.path.exists(path):
            raise FileNotFoundError(f"Model not found: {path}")
        _cache[name] = joblib.load(path)
    return _cache[name]


def get_model_meta() -> dict:
    """Return training metadata (accuracy, date, samples used)."""
    path = os.path.join(MODEL_DIR, "model_meta.json")
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {}


def predict_production_ml(req) -> dict:
    """
    Predict daily production (kg) using trained ML model.
    req has: spindle_speed, efficiency_pct, waste_pct, shift_hours,
             nominal_count, temperature_c (optional), humidity_pct (optional)
    """
    rf     = _load("production_rf.pkl")
    scaler = _load("production_scaler.pkl")
    meta   = get_model_meta()

    hour = 8  # default Shift A
    if hasattr(req, "shift_hours"):
        hour = 6 if req.shift_hours <= 8 else (14 if req.shift_hours <= 16 else 22)

    nominal_count = getattr(req, "nominal_count", 38.5)

    X = np.array([[
        req.spindle_speed,
        req.efficiency_pct,
        req.waste_pct,
        getattr(req, "temperature_c",  30.0),
        getattr(req, "humidity_pct",   60.0),
        hour,
        nominal_count,
    ]])

    X_sc   = scaler.transform(X)
    pred   = float(rf.predict(X_sc)[0])

    # Confidence from model R² score
    r2         = meta.get("prod_results", {}).get("RandomForest", {}).get("r2", 0.88)
    confidence = round(r2 * 100, 1)

    margin = pred * 0.05  # ±5%
    return {
        "predicted_value": round(pred, 1),
        "confidence_pct":  confidence,
        "lower_bound":     round(pred - margin, 1),
        "upper_bound":     round(pred + margin, 1),
        "model_version":   f"v2.0-RandomForest (R²={r2})",
        "trend":           "stable",
        "alert":           False,
        "message":         f"ML model prediction. Confidence: {confidence}%",
    }


def predict_waste_ml(req) -> dict:
    """
    Predict waste % using trained ML model.
    req has: spindle_speed, efficiency_pct, humidity_pct, temperature_c
             stage (optional, defaults to Spinning)
    """
    rf     = _load("waste_rf.pkl")
    scaler = _load("waste_scaler.pkl")
    meta   = get_model_meta()

    stage     = getattr(req, "stage", "Spinning")
    stage_enc = STAGE_IDX.get(stage, 5)  # default Spinning=5
    shift_enc = 0  # default Shift A

    X = np.array([[
        getattr(req, "temperature_c",  30.0),
        req.humidity_pct,
        req.spindle_speed,
        req.efficiency_pct,
        stage_enc,
        shift_enc,
        5500,   # default input kg
    ]])

    X_sc = scaler.transform(X)
    pred = float(rf.predict(X_sc)[0])
    pred = max(0.1, pred)

    # Determine stage limit
    limits = {
        "Blowroom":1.2,"Carding":4.5,"Combing":14.0,
        "Drawing":0.5,"Roving":0.8,"Spinning":3.25,"Winding":0.5
    }
    limit = limits.get(stage, 3.25)

    trend = "increase" if pred > limit * 0.95 else ("decrease" if pred < limit * 0.7 else "stable")
    alert = pred > limit

    r2 = meta.get("waste_results", {}).get("RandomForest", {}).get("r2", 0.90)

    messages = {
        "increase": f"⚠ Predicted waste {pred:.2f}% is near/above {stage} limit ({limit}%). Take action.",
        "decrease": f"✓ Predicted waste {pred:.2f}% is well within {stage} limit ({limit}%). Good conditions.",
        "stable":   f"→ Predicted waste {pred:.2f}% within normal range for {stage} (limit {limit}%).",
    }

    return {
        "predicted_value": round(pred, 2),
        "confidence_pct":  round(r2 * 100, 1),
        "lower_bound":     round(pred * 0.93, 2),
        "upper_bound":     round(pred * 1.07, 2),
        "model_version":   f"v2.0-RandomForest (R²={r2})",
        "trend":           trend,
        "alert":           alert,
        "message":         messages[trend],
    }


def forecast_7day(spindle_speed: float, efficiency_pct: float,
                  waste_pct: float) -> list:
    """
    Generate 7-day production forecast.
    Returns list of {day, date, predicted_kg, lower, upper}
    """
    try:
        rf     = _load("production_rf.pkl")
        scaler = _load("production_scaler.pkl")
        loaded = True
    except Exception:
        loaded = False

    from datetime import datetime, timedelta
    import random

    forecast = []
    base_temp = 30.0
    base_hum  = 60.0

    for i in range(7):
        dt    = datetime.now() + timedelta(days=i)
        hour  = 8  # day shift
        temp  = base_temp + random.gauss(0, 2)
        hum   = base_hum  + random.gauss(0, 5)
        noise = random.gauss(0, 0.015)  # 1.5% daily variation

        if loaded:
            X    = np.array([[spindle_speed, efficiency_pct, waste_pct, temp, hum, hour, 38.5]])
            X_sc = scaler.transform(X)
            pred = float(rf.predict(X_sc)[0]) * (1 + noise)
        else:
            # Physics fallback
            tpi  = 3.6
            prod = (spindle_speed * (efficiency_pct/100) * 24 * 60) / (tpi * 39.37 * 453.59)
            pred = (prod * 1008 / 1000) * 28 * (1 - waste_pct/100) * (1 + noise)

        margin = pred * 0.04
        forecast.append({
            "day":          i + 1,
            "date":         dt.strftime("%a %d %b"),
            "predicted_kg": round(pred, 0),
            "lower":        round(pred - margin, 0),
            "upper":        round(pred + margin, 0),
            "is_today":     i == 0,
        })

    return forecast


def get_waste_forecast_by_stage(temp: float, hum: float,
                                 speed: float, eff: float) -> list:
    """
    Predict waste % for all 7 stages at once.
    Used for the stage forecast chart.
    """
    try:
        rf     = _load("waste_rf.pkl")
        scaler = _load("waste_scaler.pkl")
        loaded = True
    except Exception:
        loaded = False

    LIMITS = {
        "Blowroom":1.2,"Carding":4.5,"Combing":14.0,
        "Drawing":0.5,"Roving":0.8,"Spinning":3.25,"Winding":0.5
    }

    results = []
    for stage, limit in LIMITS.items():
        stage_enc = STAGE_IDX.get(stage, 0)
        if loaded:
            X    = np.array([[temp, hum, speed, eff, stage_enc, 0, 5500]])
            X_sc = scaler.transform(X)
            pred = float(rf.predict(X_sc)[0])
            pred = max(0.05, pred)
        else:
            # Simple physics estimate
            base = {"Blowroom":1.05,"Carding":3.9,"Combing":12.8,
                    "Drawing":0.32,"Roving":0.52,"Spinning":2.85,"Winding":0.33}[stage]
            pred = base + (temp - 30) * 0.04 + (hum - 60) * 0.03

        results.append({
            "stage":     stage,
            "predicted": round(pred, 2),
            "limit":     limit,
            "alert":     pred > limit,
            "pct_of_limit": round((pred / limit) * 100, 1),
        })

    return results

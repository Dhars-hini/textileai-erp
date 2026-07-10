
import sys, os, json, math

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import joblib
import numpy as np
import random
from datetime import datetime

from sklearn.linear_model    import LinearRegression
from sklearn.ensemble        import RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing   import StandardScaler
from sklearn.metrics         import r2_score, mean_absolute_error

from app.database import SessionLocal
from app import models

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app", "models_trained")
os.makedirs(MODEL_DIR, exist_ok=True)

STAGES = ["Blowroom","Carding","Combing","Drawing","Roving","Spinning","Winding"]
STAGE_IDX = {s: i for i, s in enumerate(STAGES)}


# ── Helpers ────────────────────────────────────────────────────────

def parse_remarks(remarks: str):
    """Extract temp, humidity, speed, efficiency from AUTO remark string."""
    try:
        parts = dict(p.split("=") for p in remarks.split("|")[1:])
        return float(parts["temp"]), float(parts["hum"]), float(parts["speed"]), float(parts["eff"])
    except Exception:
        return 30.0, 60.0, 20000.0, 98.0   # defaults for manual entries


def load_waste_data(db):
    """Load all waste logs and build feature matrix."""
    logs = db.query(models.WasteLog).filter(
        models.WasteLog.actual_waste_pct > 0
    ).all()

    X_waste, y_waste = [], []
    X_prod,  y_prod  = [], []

    for log in logs:
        temp, hum, speed, eff = parse_remarks(log.remarks or "")
        stage_enc = STAGE_IDX.get(log.process_stage, 0)
        hour = log.log_date.hour if log.log_date else 12
        shift_enc = 0 if hour < 14 else (1 if hour < 22 else 2)

        # Features for WASTE prediction
        X_waste.append([temp, hum, speed, eff, stage_enc, shift_enc, log.input_material_kg or 5500])
        y_waste.append(log.actual_waste_pct)

        # Features for PRODUCTION prediction (spinning logs only)
        if log.process_stage == "Spinning":
            tpi = 3.6
            prod_8hr    = (speed * (eff / 100) * 8 * 60) / (tpi * 39.37 * 453.59)
            prod_day_kg = (prod_8hr * 3 * 1008) / 1000
            # Use 38.5 as default nominal count for logs without it
            nom = 38.5
            X_prod.append([speed, eff, log.actual_waste_pct, temp, hum, hour, nom])
            y_prod.append(prod_day_kg * 28)

    return np.array(X_waste), np.array(y_waste), np.array(X_prod), np.array(y_prod)


def train_and_save(name: str, X, y, model_lr, model_rf, scaler):
    """Train, evaluate, and save both models for a prediction type."""
    print(f"\n{'='*50}")
    print(f"Training: {name.upper()}")
    print(f"  Dataset: {len(X)} samples, {X.shape[1]} features")

    X_scaled = scaler.fit_transform(X)
    X_tr, X_te, y_tr, y_te = train_test_split(X_scaled, y, test_size=0.2, random_state=42)

    results = {}

    for label, model in [("LinearRegression", model_lr), ("RandomForest", model_rf)]:
        model.fit(X_tr, y_tr)
        y_pred = model.predict(X_te)

        r2  = r2_score(y_te, y_pred)
        mae = mean_absolute_error(y_te, y_pred)
        cv  = cross_val_score(model, X_scaled, y, cv=5, scoring="r2").mean()

        print(f"\n  [{label}]")
        print(f"    R² Score  : {r2:.4f}  ({r2*100:.1f}% variance explained)")
        print(f"    MAE       : {mae:.4f}")
        print(f"    CV R²     : {cv:.4f}")

        results[label] = {"r2": round(r2, 4), "mae": round(mae, 4), "cv_r2": round(cv, 4)}

        short = "lr" if "Linear" in label else "rf"
        path  = os.path.join(MODEL_DIR, f"{name}_{short}.pkl")
        joblib.dump(model, path)
        print(f"    Saved → {path}")

    # Save scaler
    joblib.dump(scaler, os.path.join(MODEL_DIR, f"{name}_scaler.pkl"))
    return results


# ── Main Training ──────────────────────────────────────────────────

def main():
    print("=" * 50)
    print("   TextileAI ERP - ML Model Training")
    print("=" * 50)
    print(f"Started: {datetime.now():%Y-%m-%d %H:%M:%S}")

    db = SessionLocal()
    total_logs = db.query(models.WasteLog).count()
    print(f"\n📊 Total waste logs in DB: {total_logs}")

    if total_logs < 50:
        print("\n⚠️  Not enough data! Run auto_logger first:")
        print("   python -c \"from app.auto_logger import generate_history; generate_history(30)\"")
        db.close()
        return

    # ── Train WASTE model ──────────────────────────────────────
    X_waste, y_waste, X_prod, y_prod = load_waste_data(db)

    waste_results = train_and_save(
        name     = "waste",
        X        = X_waste,
        y        = y_waste,
        model_lr = LinearRegression(),
        model_rf = RandomForestRegressor(n_estimators=150, max_depth=10, random_state=42, n_jobs=-1),
        scaler   = StandardScaler(),
    )

    # ── Train PRODUCTION model ────────────────────────────────
    if len(X_prod) < 20:
        # Generate synthetic production data from physics formula
        print("\n  [Production] Generating synthetic training data from physics formula...")
        rows = []
        targets = []
        for _ in range(800):
            speed = random.uniform(17000, 22000)
            eff   = random.uniform(91, 99.5)
            waste = random.uniform(2.5, 5.0)
            temp  = random.uniform(24, 42)
            hum   = random.uniform(44, 80)
            hour  = random.randint(0, 23)
            tpi   = random.uniform(3.2, 4.0)
            nom   = random.choice([23, 29, 38.5, 41])

            prod_8hr  = (speed * (eff/100) * 8 * 60) / (tpi * 39.37 * 453.59)
            prod_24hr = prod_8hr * 3
            prod_day  = (prod_24hr * 1008) / 1000 * 28 * (1 - waste/100)
            prod_day  *= (1 + random.gauss(0, 0.03))  # noise

            rows.append([speed, eff, waste, temp, hum, hour, nom])
            targets.append(prod_day)

        X_prod = np.array(rows)
        y_prod = np.array(targets)

    prod_results = train_and_save(
        name     = "production",
        X        = X_prod,
        y        = y_prod,
        model_lr = LinearRegression(),
        model_rf = RandomForestRegressor(n_estimators=150, max_depth=10, random_state=42, n_jobs=-1),
        scaler   = StandardScaler(),
    )

    db.close()

    # ── Save metadata ──────────────────────────────────────────
    meta = {
        "trained_at":      datetime.now().isoformat(),
        "total_logs_used": int(total_logs),
        "waste_samples":   len(X_waste),
        "prod_samples":    len(X_prod),
        "waste_features":  ["temp","humidity","spindle_speed","efficiency","stage_id","shift_id","input_kg"],
        "prod_features":   ["spindle_speed","efficiency","waste_pct","temperature","humidity","hour","nominal_count"],
        "waste_results":   waste_results,
        "prod_results":    prod_results,
        "best_waste_model":  "RandomForest" if waste_results["RandomForest"]["r2"] > waste_results["LinearRegression"]["r2"] else "LinearRegression",
        "best_prod_model":   "RandomForest" if prod_results["RandomForest"]["r2"]  > prod_results["LinearRegression"]["r2"]  else "LinearRegression",
    }

    meta_path = os.path.join(MODEL_DIR, "model_meta.json")
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\n\n{'='*50}")
    print("✅ TRAINING COMPLETE")
    print(f"{'='*50}")
    print(f"  Best Waste Model      : {meta['best_waste_model']}  (R²={waste_results[meta['best_waste_model']]['r2']})")
    print(f"  Best Production Model : {meta['best_prod_model']}   (R²={prod_results[meta['best_prod_model']]['r2']})")
    print(f"\n  Metadata saved → {meta_path}")
    print(f"\n  Now restart the backend — ML models will load automatically!")

if __name__ == "__main__":
    main()

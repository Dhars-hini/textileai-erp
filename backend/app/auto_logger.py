"""
auto_logger.py
══════════════════════════════════════════════════════════════════
Automatic waste log generator for TextileAI ERP.

Two modes:
  1. generate_history(days=30)  → fills past N days for ML training
  2. generate_shift_log()       → generates one current shift entry

Both write to the SAME waste_logs table as manual entries.
Remarks field stores "AUTO|..." to distinguish from manual.

Conditions simulated:
  - Temperature (peaks in afternoon shift)
  - Humidity (random realistic range)
  - Spindle speed variation (machine wear)
  - Efficiency drop in night shift
  - Random noise like real sensor data
══════════════════════════════════════════════════════════════════
"""

import sys, os, random, math
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app import models

# ── Stage configuration ───────────────────────────────────────────
STAGES = {
    "Blowroom": {"limit": 1.2,  "base": 1.05, "spread": 0.35},
    "Carding":  {"limit": 4.5,  "base": 3.90, "spread": 0.90},
    "Combing":  {"limit": 14.0, "base": 12.8, "spread": 1.80},
    "Drawing":  {"limit": 0.5,  "base": 0.32, "spread": 0.16},
    "Roving":   {"limit": 0.8,  "base": 0.52, "spread": 0.24},
    "Spinning": {"limit": 3.25, "base": 2.85, "spread": 0.70},
    "Winding":  {"limit": 0.5,  "base": 0.33, "spread": 0.15},
}

SHIFTS = ["Shift A", "Shift B", "Shift C"]

# Realistic input material per stage per shift (kg)
INPUT_KG = {
    "Blowroom": 6500, "Carding": 6300, "Combing": 6100,
    "Drawing":  5800, "Roving":  5700, "Spinning": 5500, "Winding": 5400,
}

SHIFT_HOURS = {"Shift A": 6, "Shift B": 14, "Shift C": 22}


def _simulate_env(dt: datetime, shift: str):
    """Return (temp°C, humidity%, spindle_rpm, efficiency%) for given shift."""
    hour = SHIFT_HOURS[shift]

    # Temperature: peaks in afternoon (Shift B)
    temp = 28 + 8 * math.sin((hour - 6) * math.pi / 12) + random.gauss(0, 1.5)
    temp = round(max(24.0, min(42.0, temp)), 1)

    # Humidity: random but realistic mill range
    hum = 58 + random.gauss(0, 7)
    hum = round(max(44.0, min(80.0, hum)), 1)

    # Spindle speed: minor variation around 20000 RPM
    speed = 20000 + random.gauss(0, 320)
    speed = round(max(18000.0, min(21500.0, speed)), 0)

    # Efficiency: night shift (Shift C) operators are more tired
    eff = 98.0 - (1.8 if shift == "Shift C" else 0.0) + random.gauss(0, 0.9)
    eff = round(max(91.0, min(99.5, eff)), 2)

    return temp, hum, speed, eff


def _waste_for_stage(stage: str, temp, hum, speed, eff) -> float:
    """Physics-based waste % with environmental factors + noise."""
    cfg  = STAGES[stage]
    val  = cfg["base"]

    # High temp → more fibre breakage
    if temp > 35:
        val += (temp - 35) * 0.05

    # High humidity → fibres stick, more carding/blowroom waste
    if hum > 65:
        val += (hum - 65) * 0.04

    # High spindle speed → more spinning waste
    if stage == "Spinning" and speed > 20000:
        val += (speed - 20000) / 1000 * 0.025

    # Low efficiency → more rejects
    if eff < 96:
        val += (96 - eff) * 0.07

    # Add realistic random noise
    val += random.gauss(0, cfg["spread"] * 0.28)
    val = max(cfg["base"] * 0.45, val)   # floor at 45% of base

    return round(val, 2)


# ── Public API ────────────────────────────────────────────────────

def generate_history(days: int = 30, verbose: bool = True) -> int:
    """
    Generate N days of historical waste logs (all stages, all shifts).
    Saves AUTO-tagged entries to waste_logs table.
    Returns total rows inserted.
    """
    db    = SessionLocal()
    total = 0

    try:
        for day_back in range(days, 0, -1):
            dt = datetime.now() - timedelta(days=day_back)

            for shift in SHIFTS:
                temp, hum, speed, eff = _simulate_env(dt, shift)

                for stage, cfg in STAGES.items():
                    waste_pct = _waste_for_stage(stage, temp, hum, speed, eff)
                    waste_kg  = round(INPUT_KG[stage] * waste_pct / 100, 2)
                    is_alert  = waste_pct > cfg["limit"]

                    db.add(models.WasteLog(
                        log_date          = dt,
                        shift             = shift,
                        process_stage     = stage,
                        input_material_kg = round(INPUT_KG[stage] + random.gauss(0, 40), 1),
                        actual_waste_pct  = waste_pct,
                        waste_kg          = waste_kg,
                        normal_limit_pct  = cfg["limit"],
                        is_alert          = is_alert,
                        remarks           = f"AUTO|temp={temp}|hum={hum}|speed={speed}|eff={eff}",
                    ))
                    total += 1

            if verbose and day_back % 10 == 0:
                print(f"  → Generated logs for {day_back} days ago")

        db.commit()
        if verbose:
            print(f"✅ History complete: {total} rows ({days} days × 3 shifts × 7 stages)")
    finally:
        db.close()

    return total


def generate_shift_log(shift: str = None, verbose: bool = True) -> int:
    """
    Generate one shift's worth of waste logs for right now.
    Auto-detects current shift if not specified.
    Returns rows inserted.
    """
    db  = SessionLocal()
    now = datetime.now()

    if shift is None:
        h = now.hour
        shift = "Shift A" if 6 <= h < 14 else ("Shift B" if 14 <= h < 22 else "Shift C")

    temp, hum, speed, eff = _simulate_env(now, shift)
    count = 0

    try:
        for stage, cfg in STAGES.items():
            waste_pct = _waste_for_stage(stage, temp, hum, speed, eff)
            waste_kg  = round(INPUT_KG[stage] * waste_pct / 100, 2)
            is_alert  = waste_pct > cfg["limit"]

            db.add(models.WasteLog(
                log_date          = now,
                shift             = shift,
                process_stage     = stage,
                input_material_kg = INPUT_KG[stage],
                actual_waste_pct  = waste_pct,
                waste_kg          = waste_kg,
                normal_limit_pct  = cfg["limit"],
                is_alert          = is_alert,
                remarks           = f"AUTO|temp={temp}|hum={hum}|speed={speed}|eff={eff}",
            ))
            count += 1

        db.commit()
        if verbose:
            print(f"✅ Auto-log: {shift} | {now:%Y-%m-%d %H:%M} | "
                  f"Temp={temp}°C  Hum={hum}%  Speed={speed:.0f}RPM  Eff={eff}%")
    finally:
        db.close()

    return count


if __name__ == "__main__":
    print("Generating 30-day history...")
    generate_history(30)
    print("\nGenerating current shift log...")
    generate_shift_log()
    print("\nDone! Run: python train_model.py")

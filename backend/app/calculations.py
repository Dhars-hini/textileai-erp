"""
calculations.py
────────────────────────────────────────────────────────────────
All textile spinning mill calculation logic, directly ported
from the Excel sheet formulas.
"""
import math
from app.schemas import QuickCalcRequest, QuickCalcResponse, MaterialRequirementRequest, MaterialRequirementResponse

# Normal waste limits per process stage (from industry standard)
NORMAL_WASTE_LIMITS = {
    "Blowroom": 1.2,
    "Carding":  4.5,
    "Combing":  14.0,
    "Drawing":  0.5,
    "Roving":   0.8,
    "Spinning": 3.25,
    "Winding":  0.5,
}


def calculate_spinning(req: QuickCalcRequest) -> QuickCalcResponse:
    """
    Port of Excel Sheet1 spinning section formulas.

    Key formulas from Excel:
    - TM = TPI / sqrt(Nominal Count)
    - Prod/spl/8hr (gms) = (SpindleSpeed * Eff * 8 * 60) / (TPI * 39.37 * 453.59)
    - Prod/spl/24hr = Prod/8hr * 3
    - Prod/frame/day (kg) = (Prod/spl/24hr * SpindlesPerMachine) / 1000
    - Spindles Required = (ProductionKg * 1000) / Prod/spl/24hr
    - Frames Required = Spindles Required / SpindlesPerMachine
    - Output with Waste = ProductionKg / (1 - waste%)
    - Total Mixing = OutputWithWaste * 1.07  (blowroom + carding allowance)
    - Bales/day = TotalMixing / 165
    - Bags/day = ProductionKg / 50
    """
    p = req.production_target_kg
    nc = req.nominal_count
    ss = req.spindle_speed
    tpi = req.tpi
    eff = req.efficiency_pct / 100.0
    spm = req.spindles_per_machine
    waste = req.waste_pct / 100.0

    # Twist Multiplier
    tm = tpi / math.sqrt(nc)

    # Production per spindle per 8-hour shift (grams)
    # Formula: (speed * efficiency * time_in_minutes) / (TPI * inches_per_meter * grams_per_lb)
    prod_8hr = (ss * eff * 8 * 60) / (tpi * 39.37 * 453.59)

    # 24-hour production
    prod_24hr = prod_8hr * 3

    # Production per frame per day (kg)
    prod_frame_day = (prod_24hr * spm) / 1000.0

    # Spindles and frames needed
    spindles_req = (p * 1000) / prod_24hr
    frames_req   = spindles_req / spm

    # Cotton input required (accounting for spinning waste)
    output_with_waste = p / (1 - waste)

    # Total mixing requirement (adds blowroom + carding + drawing waste ~ 7%)
    total_mixing = output_with_waste * 1.07

    # Bales and bags
    bales_per_day    = total_mixing / 165.0
    bags_per_day     = int(p / 50)
    bags_per_month   = bags_per_day * 30

    return QuickCalcResponse(
        twist_multiplier       = round(tm, 4),
        prod_per_spl_8hr_gms   = round(prod_8hr, 4),
        prod_per_spl_24hr_gms  = round(prod_24hr, 4),
        prod_per_frame_day_kg  = round(prod_frame_day, 4),
        spindles_required      = round(spindles_req, 2),
        frames_required        = round(frames_req, 4),
        output_with_waste_kg   = round(output_with_waste, 2),
        yarn_bags_per_day      = bags_per_day,
        yarn_bags_per_month    = bags_per_month,
        bales_per_day          = round(bales_per_day, 4),
        total_mixing_kg        = round(total_mixing, 2),
    )


def calculate_material_requirement(req: MaterialRequirementRequest) -> MaterialRequirementResponse:
    """
    Calculate total cotton requirement considering all process waste stages.
    Matches Excel rows for blowroom → carding → combing → drawing → spinning chain.
    """
    total_waste = (
        req.spinning_waste_pct
        + req.carding_waste_pct
        + req.blowroom_waste_pct
        + req.combing_waste_pct
    ) / 100.0

    cotton_kg   = req.production_target_kg / (1 - total_waste)
    bales       = cotton_kg / req.avg_bale_weight
    monthly_kg  = cotton_kg * 30
    monthly_bales = bales * 30

    return MaterialRequirementResponse(
        total_waste_pct    = round(total_waste * 100, 2),
        cotton_required_kg = round(cotton_kg, 2),
        bales_required     = round(bales, 2),
        monthly_cotton_kg  = round(monthly_kg, 2),
        monthly_bales      = round(monthly_bales, 2),
    )


def get_waste_limit(stage: str) -> float:
    """Return the normal waste limit % for a given process stage."""
    return NORMAL_WASTE_LIMITS.get(stage, 5.0)


def is_waste_alert(stage: str, actual_pct: float) -> bool:
    return actual_pct > get_waste_limit(stage)

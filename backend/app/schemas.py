from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# ─────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────
class UserCreate(BaseModel):
    username:  str
    email:     EmailStr
    full_name: Optional[str] = None
    password:  str
    role:      str = "operator"

class UserOut(BaseModel):
    id:        int
    username:  str
    email:     str
    full_name: Optional[str]
    role:      str
    is_active: bool
    class Config: from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type:   str = "bearer"

class LoginRequest(BaseModel):
    username: str
    password: str


# ─────────────────────────────────────────────
# YARN COUNT
# ─────────────────────────────────────────────
class YarnCountCreate(BaseModel):
    count_label:          str
    nominal_count:        float
    spindle_speed:        float
    tpi:                  float
    efficiency_pct:       float = 98.0
    spindles_per_machine: int   = 1008
    spinning_waste_pct:   float = 3.25

class YarnCountOut(YarnCountCreate):
    id:         int
    is_active:  bool
    created_at: datetime
    class Config: from_attributes = True


# ─────────────────────────────────────────────
# PRODUCTION PLANNING
# ─────────────────────────────────────────────
class ProductionEntryCreate(BaseModel):
    yarn_count_id:        int
    production_target_kg: float
    spindle_speed:        Optional[float] = None
    efficiency_pct:       Optional[float] = None
    waste_pct:            Optional[float] = None

class ProductionEntryOut(BaseModel):
    id:                    int
    yarn_count_id:         int
    production_target_kg:  float
    twist_multiplier:      Optional[float]
    prod_per_spl_8hr_gms:  Optional[float]
    prod_per_spl_24hr_gms: Optional[float]
    prod_per_frame_day_kg: Optional[float]
    spindles_required:     Optional[float]
    frames_required:       Optional[float]
    output_with_waste_kg:  Optional[float]
    yarn_bags_per_day:     Optional[int]
    yarn_bags_per_month:   Optional[int]
    bales_per_day:         Optional[float]
    total_mixing_kg:       Optional[float]
    class Config: from_attributes = True

class PlanCreate(BaseModel):
    plan_date:  datetime
    plan_name:  Optional[str] = None
    notes:      Optional[str] = None
    entries:    List[ProductionEntryCreate]

class PlanOut(BaseModel):
    id:         int
    plan_date:  datetime
    plan_name:  Optional[str]
    notes:      Optional[str]
    created_at: datetime
    entries:    List[ProductionEntryOut] = []
    class Config: from_attributes = True

# Quick calculate (no DB save)
class QuickCalcRequest(BaseModel):
    production_target_kg: float
    nominal_count:        float
    spindle_speed:        float
    tpi:                  float
    efficiency_pct:       float = 98.0
    spindles_per_machine: int   = 1008
    waste_pct:            float = 3.25

class QuickCalcResponse(BaseModel):
    twist_multiplier:      float
    prod_per_spl_8hr_gms:  float
    prod_per_spl_24hr_gms: float
    prod_per_frame_day_kg: float
    spindles_required:     float
    frames_required:       float
    output_with_waste_kg:  float
    yarn_bags_per_day:     int
    yarn_bags_per_month:   int
    bales_per_day:         float
    total_mixing_kg:       float


# ─────────────────────────────────────────────
# RAW MATERIAL
# ─────────────────────────────────────────────
class InventoryCreate(BaseModel):
    material_name:    str
    stock_kg:         float = 0.0
    reorder_point_kg: float = 3000.0
    avg_bale_weight:  float = 165.0

class InventoryOut(InventoryCreate):
    id:         int
    updated_at: datetime
    class Config: from_attributes = True

class InventoryUpdate(BaseModel):
    stock_kg:         Optional[float] = None
    reorder_point_kg: Optional[float] = None

class TransactionCreate(BaseModel):
    inventory_id:     int
    transaction_type: str   # IN | OUT
    quantity_kg:      float
    bales_count:      Optional[int] = None
    reference_note:   Optional[str] = None

class TransactionOut(TransactionCreate):
    id:            int
    transacted_at: datetime
    class Config: from_attributes = True

class MaterialRequirementRequest(BaseModel):
    production_target_kg: float
    spinning_waste_pct:   float = 3.25
    carding_waste_pct:    float = 4.5
    blowroom_waste_pct:   float = 1.2
    combing_waste_pct:    float = 14.0
    avg_bale_weight:      float = 165.0

class MaterialRequirementResponse(BaseModel):
    total_waste_pct:       float
    cotton_required_kg:    float
    bales_required:        float
    monthly_cotton_kg:     float
    monthly_bales:         float


# ─────────────────────────────────────────────
# WASTE MONITORING
# ─────────────────────────────────────────────
class WasteLogCreate(BaseModel):
    log_date:         datetime
    shift:            str
    process_stage:    str
    yarn_count_id:    Optional[int] = None
    input_material_kg: float
    actual_waste_pct:  float
    remarks:          Optional[str] = None

class WasteLogOut(BaseModel):
    id:               int
    log_date:         datetime
    shift:            str
    process_stage:    str
    input_material_kg: float
    actual_waste_pct:  float
    waste_kg:         Optional[float]
    normal_limit_pct: Optional[float]
    is_alert:         bool
    remarks:          Optional[str]
    created_at:       datetime
    class Config: from_attributes = True

class WasteSummaryResponse(BaseModel):
    total_entries:   int
    avg_waste_pct:   float
    total_waste_kg:  float
    alert_count:     int
    by_stage:        dict


# ─────────────────────────────────────────────
# AI PREDICTION
# ─────────────────────────────────────────────
class ProductionPredictRequest(BaseModel):
    spindle_speed:  float
    efficiency_pct: float
    waste_pct:      float
    shift_hours:    float = 24.0
    nominal_count:  float

class WastePredictRequest(BaseModel):
    spindle_speed:  float
    efficiency_pct: float
    humidity_pct:   float
    temperature_c:  float

class PredictionResponse(BaseModel):
    predicted_value: float
    confidence_pct:  float
    lower_bound:     float
    upper_bound:     float
    trend:           Optional[str] = None
    alert:           bool = False
    message:         Optional[str] = None
    model_version:   str = "v1.0"

from sqlalchemy import (
    Column, Integer, Float, String, Boolean,
    DateTime, ForeignKey, Text, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


# ─────────────────────────────────────────────
# ENUMS
# ─────────────────────────────────────────────
class ShiftEnum(str, enum.Enum):
    A = "Shift A"
    B = "Shift B"
    C = "Shift C"


# ─────────────────────────────────────────────
# USER
# ─────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username   = Column(String(50), unique=True, nullable=False)
    email      = Column(String(100), unique=True, nullable=False)
    full_name  = Column(String(100))
    hashed_pw  = Column(String(255), nullable=False)
    is_active  = Column(Boolean, default=True)
    role       = Column(String(20), default="operator")   # admin | supervisor | operator
    created_at = Column(DateTime, server_default=func.now())


# ─────────────────────────────────────────────
# YARN COUNT MASTER
# ─────────────────────────────────────────────
class YarnCount(Base):
    """Master table of yarn count configurations — from Excel rows."""
    __tablename__ = "yarn_counts"

    id                   = Column(Integer, primary_key=True, index=True, autoincrement=True)
    count_label          = Column(String(50), unique=True, nullable=False)
    nominal_count        = Column(Float, nullable=False)
    spindle_speed        = Column(Float, nullable=False)
    tpi                  = Column(Float, nullable=False)
    efficiency_pct       = Column(Float, default=98.0)
    spindles_per_machine = Column(Integer, default=1008)
    spinning_waste_pct   = Column(Float, default=3.25)
    is_active            = Column(Boolean, default=True)
    created_at           = Column(DateTime, server_default=func.now())

    production_entries = relationship("ProductionEntry", back_populates="yarn_count")
    waste_logs         = relationship("WasteLog", back_populates="yarn_count")


# ─────────────────────────────────────────────
# PRODUCTION PLANNING
# ─────────────────────────────────────────────
class ProductionPlan(Base):
    __tablename__ = "production_plans"

    id         = Column(Integer, primary_key=True, index=True, autoincrement=True)
    plan_date  = Column(DateTime, nullable=False)
    plan_name  = Column(String(100))
    created_by = Column(Integer, ForeignKey("users.id"))
    notes      = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    entries = relationship("ProductionEntry", back_populates="plan", cascade="all, delete-orphan")
    creator = relationship("User")


class ProductionEntry(Base):
    """One yarn count row inside a production plan — inputs + calculated outputs."""
    __tablename__ = "production_entries"

    id                    = Column(Integer, primary_key=True, index=True, autoincrement=True)
    plan_id               = Column(Integer, ForeignKey("production_plans.id"), nullable=False)
    yarn_count_id         = Column(Integer, ForeignKey("yarn_counts.id"), nullable=False)

    # Inputs
    production_target_kg  = Column(Float, nullable=False)
    spindle_speed         = Column(Float)
    efficiency_pct        = Column(Float)
    waste_pct             = Column(Float)

    # Calculated outputs
    twist_multiplier      = Column(Float)
    prod_per_spl_8hr_gms  = Column(Float)
    prod_per_spl_24hr_gms = Column(Float)
    prod_per_frame_day_kg = Column(Float)
    spindles_required     = Column(Float)
    frames_required       = Column(Float)
    output_with_waste_kg  = Column(Float)
    yarn_bags_per_day     = Column(Integer)
    yarn_bags_per_month   = Column(Integer)
    bales_per_day         = Column(Float)
    total_mixing_kg       = Column(Float)

    created_at = Column(DateTime, server_default=func.now())

    plan       = relationship("ProductionPlan", back_populates="entries")
    yarn_count = relationship("YarnCount", back_populates="production_entries")


# ─────────────────────────────────────────────
# RAW MATERIAL / INVENTORY
# ─────────────────────────────────────────────
class RawMaterialInventory(Base):
    __tablename__ = "raw_material_inventory"

    id               = Column(Integer, primary_key=True, index=True, autoincrement=True)
    material_name    = Column(String(100), nullable=False)
    stock_kg         = Column(Float, default=0.0)
    reorder_point_kg = Column(Float, default=3000.0)
    avg_bale_weight  = Column(Float, default=165.0)
    updated_at       = Column(DateTime, onupdate=func.now(), server_default=func.now())
    updated_by       = Column(Integer, ForeignKey("users.id"), nullable=True)


class MaterialTransaction(Base):
    __tablename__ = "material_transactions"

    id               = Column(Integer, primary_key=True, index=True, autoincrement=True)
    inventory_id     = Column(Integer, ForeignKey("raw_material_inventory.id"))
    transaction_type = Column(String(10), nullable=False)   # IN | OUT
    quantity_kg      = Column(Float, nullable=False)
    bales_count      = Column(Integer)
    reference_note   = Column(String(200))
    transacted_at    = Column(DateTime, server_default=func.now())
    transacted_by    = Column(Integer, ForeignKey("users.id"), nullable=True)


# ─────────────────────────────────────────────
# WASTE MONITORING
# ─────────────────────────────────────────────
class WasteLog(Base):
    __tablename__ = "waste_logs"

    id                = Column(Integer, primary_key=True, index=True, autoincrement=True)
    log_date          = Column(DateTime, nullable=False)
    # Store shift as plain string — avoids MySQL ENUM DDL issues
    shift             = Column(String(20), nullable=False)   # Shift A | Shift B | Shift C
    process_stage     = Column(String(50), nullable=False)
    yarn_count_id     = Column(Integer, ForeignKey("yarn_counts.id"), nullable=True)
    input_material_kg = Column(Float, nullable=False)
    actual_waste_pct  = Column(Float, nullable=False)
    waste_kg          = Column(Float)
    normal_limit_pct  = Column(Float)
    is_alert          = Column(Boolean, default=False)
    remarks           = Column(Text)
    logged_by         = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at        = Column(DateTime, server_default=func.now())

    yarn_count = relationship("YarnCount", back_populates="waste_logs")


# ─────────────────────────────────────────────
# AI PREDICTION LOG
# ─────────────────────────────────────────────
class PredictionLog(Base):
    __tablename__ = "prediction_logs"

    id              = Column(Integer, primary_key=True, index=True, autoincrement=True)
    prediction_type = Column(String(30))       # production | waste | failure
    input_features  = Column(Text)             # JSON string of inputs
    predicted_value = Column(Float)
    confidence_pct  = Column(Float)
    lower_bound     = Column(Float)
    upper_bound     = Column(Float)
    actual_value    = Column(Float, nullable=True)
    model_version   = Column(String(20), default="v1.0")
    predicted_at    = Column(DateTime, server_default=func.now())
    predicted_by    = Column(Integer, ForeignKey("users.id"), nullable=True)

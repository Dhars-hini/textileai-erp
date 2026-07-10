from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user
from app.calculations import calculate_material_requirement

router = APIRouter(prefix="/api/raw-material", tags=["Raw Material"])


@router.get("/inventory", response_model=List[schemas.InventoryOut])
def list_inventory(db: Session = Depends(get_db), _user = Depends(get_current_user)):
    return db.query(models.RawMaterialInventory).all()


@router.post("/inventory", response_model=schemas.InventoryOut, status_code=201)
def create_inventory(
    data: schemas.InventoryCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    obj = models.RawMaterialInventory(**data.model_dump(), updated_by=user.id)
    db.add(obj); db.commit(); db.refresh(obj)
    return obj


@router.patch("/inventory/{inv_id}", response_model=schemas.InventoryOut)
def update_inventory(
    inv_id: int,
    data: schemas.InventoryUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    obj = db.query(models.RawMaterialInventory).filter(models.RawMaterialInventory.id == inv_id).first()
    if not obj: raise HTTPException(404, "Inventory not found")
    if data.stock_kg is not None: obj.stock_kg = data.stock_kg
    if data.reorder_point_kg is not None: obj.reorder_point_kg = data.reorder_point_kg
    obj.updated_by = user.id
    db.commit(); db.refresh(obj)
    return obj


@router.post("/transaction", response_model=schemas.TransactionOut, status_code=201)
def add_transaction(
    data: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    inv = db.query(models.RawMaterialInventory).filter(models.RawMaterialInventory.id == data.inventory_id).first()
    if not inv: raise HTTPException(404, "Inventory record not found")

    # Update stock
    if data.transaction_type == "IN":
        inv.stock_kg += data.quantity_kg
    elif data.transaction_type == "OUT":
        if inv.stock_kg < data.quantity_kg:
            raise HTTPException(400, f"Insufficient stock. Available: {inv.stock_kg} kg")
        inv.stock_kg -= data.quantity_kg
    else:
        raise HTTPException(400, "transaction_type must be IN or OUT")

    inv.updated_by = user.id

    tx = models.MaterialTransaction(
        inventory_id     = data.inventory_id,
        transaction_type = data.transaction_type,
        quantity_kg      = data.quantity_kg,
        bales_count      = data.bales_count,
        reference_note   = data.reference_note,
        transacted_by    = user.id,
    )
    db.add(tx); db.commit(); db.refresh(tx)
    return tx


@router.get("/transactions", response_model=List[schemas.TransactionOut])
def list_transactions(
    inventory_id: int = None,
    db: Session = Depends(get_db),
    _user = Depends(get_current_user),
):
    q = db.query(models.MaterialTransaction)
    if inventory_id:
        q = q.filter(models.MaterialTransaction.inventory_id == inventory_id)
    return q.order_by(models.MaterialTransaction.transacted_at.desc()).limit(100).all()


@router.post("/calculate-requirement", response_model=schemas.MaterialRequirementResponse)
def calc_requirement(req: schemas.MaterialRequirementRequest):
    """Calculate cotton bale requirement given production target and waste %."""
    return calculate_material_requirement(req)


@router.get("/stock-status")
def stock_status(db: Session = Depends(get_db), _user = Depends(get_current_user)):
    """Returns all inventory with stock status (ok / warn / critical)."""
    items = db.query(models.RawMaterialInventory).all()
    result = []
    for item in items:
        ratio = item.stock_kg / item.reorder_point_kg if item.reorder_point_kg else 1
        if ratio >= 1:
            status = "ok"
        elif ratio >= 0.5:
            status = "warn"
        else:
            status = "critical"
        result.append({
            "id": item.id,
            "material_name": item.material_name,
            "stock_kg": item.stock_kg,
            "reorder_point_kg": item.reorder_point_kg,
            "status": status,
            "days_of_stock": round(item.stock_kg / item.reorder_point_kg * 30, 1) if item.reorder_point_kg else None,
        })
    return result

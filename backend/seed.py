"""
seed.py - Run once to create tables and add initial data.
Usage:  python seed.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app import models
from app.auth import hash_password

def seed():
    print("Creating database tables...")
    models.Base.metadata.create_all(bind=engine)
    print("Tables created!")

    db = SessionLocal()

    if not db.query(models.User).filter(models.User.username == "admin").first():
        db.add(models.User(
            username  = "admin",
            email     = "admin@textileai.com",
            full_name = "Admin User",
            hashed_pw = hash_password("admin123"),
            role      = "admin",
        ))
        print("Created admin user  (admin / admin123)")
    else:
        print("Admin user already exists")

    yarn_counts = [
        {"count_label": "40s Cbd Hsy",  "nominal_count": 38.5, "spindle_speed": 20000, "tpi": 3.6, "efficiency_pct": 98, "spindles_per_machine": 1008, "spinning_waste_pct": 3.25},
        {"count_label": "40s Cbd Warp", "nominal_count": 41.0, "spindle_speed": 21000, "tpi": 3.6, "efficiency_pct": 98, "spindles_per_machine": 1008, "spinning_waste_pct": 3.25},
        {"count_label": "30s Cbd Hsy",  "nominal_count": 29.0, "spindle_speed": 18000, "tpi": 3.6, "efficiency_pct": 98, "spindles_per_machine": 1008, "spinning_waste_pct": 3.25},
        {"count_label": "24s Cbd Hsy",  "nominal_count": 23.0, "spindle_speed": 17000, "tpi": 3.6, "efficiency_pct": 98, "spindles_per_machine": 1008, "spinning_waste_pct": 3.25},
    ]
    for yc in yarn_counts:
        if not db.query(models.YarnCount).filter(models.YarnCount.count_label == yc["count_label"]).first():
            db.add(models.YarnCount(**yc))
            print(f"Added yarn count: {yc['count_label']}")

    if not db.query(models.RawMaterialInventory).first():
        db.add(models.RawMaterialInventory(
            material_name    = "Cotton Bales",
            stock_kg         = 5000.0,
            reorder_point_kg = 3000.0,
            avg_bale_weight  = 165.0,
        ))
        print("Created cotton inventory record")

    db.commit()
    db.close()
    print("\nDone! Visit http://localhost:8000/docs after starting server.")

if __name__ == "__main__":
    seed()

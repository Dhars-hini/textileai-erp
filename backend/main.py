import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine
from app import models
from app.routers import auth, production, raw_material, waste, prediction, optimize

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title       = settings.APP_NAME,
    description = "AI-Powered Textile Spinning Mill ERP",
    version     = "1.0.0",
)

# Enhanced debug output
print("=" * 60)
print("🔧 CORS CONFIGURATION")
print("=" * 60)
print(f"ALLOWED_ORIGINS (raw): {settings.ALLOWED_ORIGINS}")
print(f"origins_list (parsed): {settings.origins_list}")
print("=" * 60)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = settings.origins_list,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

app.include_router(auth.router)
app.include_router(production.router)
app.include_router(raw_material.router)
app.include_router(waste.router)
app.include_router(prediction.router)
app.include_router(optimize.router, prefix="/api", tags=["optimize"])

@app.get("/")
def root():
    return {"status": "ok", "app": settings.APP_NAME}

@app.get("/health")
def health():
    return {"status": "healthy"}
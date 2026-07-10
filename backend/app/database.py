from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# pymysql driver — no extra binary needed, pure Python
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,       # auto-reconnect on dropped connections
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,        # recycle connections every hour (important for MySQL)
    connect_args={
        "charset": "utf8mb4"  # full unicode support including emojis
    },
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session and closes it after request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

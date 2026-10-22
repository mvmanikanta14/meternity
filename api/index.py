# Vercel serverless entry point: serves the FastAPI backend under /api.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.database import init_db  # noqa: E402
from app.main import app, seed_default_user  # noqa: E402,F401

# Serverless functions may not run FastAPI startup events, so prepare the database on import.
init_db()
seed_default_user()

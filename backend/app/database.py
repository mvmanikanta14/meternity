import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

# Live (Vercel + Neon) sets DATABASE_URL to a Postgres URL; locally we fall back to a SQLite file.
DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
USE_POSTGRES = bool(DATABASE_URL)
DB_PATH = Path(__file__).resolve().parent.parent / "maternity.db"

SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    lmp_date TEXT,
    blood_group TEXT,
    doctor_name TEXT,
    hospital TEXT,
    phone TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS health_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date TEXT NOT NULL,
    weight REAL,
    systolic INTEGER,
    diastolic INTEGER,
    water_glasses INTEGER,
    mood TEXT,
    symptoms TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    doctor TEXT,
    location TEXT,
    date TEXT NOT NULL,
    time TEXT,
    notes TEXT,
    done INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kick_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    kicks INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
"""

# Same tables for Postgres. Timestamps stay TEXT so the API returns the same shape on both.
POSTGRES_SCHEMA = (
    SQLITE_SCHEMA.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
    .replace("REAL", "DOUBLE PRECISION")
    .replace("DEFAULT CURRENT_TIMESTAMP", "DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))")
)


def init_db() -> None:
    with get_conn() as conn:
        if USE_POSTGRES:
            for statement in POSTGRES_SCHEMA.split(";"):
                if statement.strip():
                    conn.execute(statement)
        else:
            conn.executescript(SQLITE_SCHEMA)
            migrate_email_to_username(conn)


def migrate_email_to_username(conn) -> None:
    """Older databases stored an email; turn it into a username (the part before @)."""
    columns = [r["name"] for r in conn.execute("PRAGMA table_info(users)")]
    if "email" not in columns:
        return
    conn.execute("ALTER TABLE users RENAME COLUMN email TO username")
    for row in conn.execute("SELECT id, username FROM users WHERE username LIKE '%@%'").fetchall():
        candidate = row["username"].split("@")[0]
        if not conn.execute("SELECT 1 FROM users WHERE username = ?", (candidate,)).fetchone():
            conn.execute("UPDATE users SET username = ? WHERE id = ?", (candidate, row["id"]))


class PostgresConn:
    """Lets the app keep writing SQLite-style `?` placeholders against Postgres."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql: str, params=()):
        return self._conn.execute(sql.replace("?", "%s"), params)


@contextmanager
def get_conn():
    if USE_POSTGRES:
        import psycopg
        from psycopg.rows import dict_row

        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            yield PostgresConn(conn)
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def row_to_dict(row):
    return dict(row) if row is not None else None

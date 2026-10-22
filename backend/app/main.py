import json
from datetime import date, timedelta

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .database import get_conn, init_db, row_to_dict
from .schemas import AppointmentIn, HealthLogIn, KickSessionIn, LoginIn, ProfileIn, RegisterIn
from .security import create_session, current_user, delete_session, hash_password, verify_password
from .week_data import WEEKS, get_week

PREGNANCY_DAYS = 280

app = FastAPI(title="Maternity Tracker API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    seed_default_user()


# Built-in account so the app can be logged into right after a fresh deploy.
DEFAULT_USER = {"name": "Prasu", "username": "prasu", "password": "123456"}


def seed_default_user() -> None:
    with get_conn() as conn:
        if conn.execute("SELECT 1 FROM users WHERE username = ?", (DEFAULT_USER["username"],)).fetchone():
            return
        # ON CONFLICT: two serverless instances may start at the same moment.
        conn.execute(
            "INSERT INTO users (name, username, password_hash) VALUES (?, ?, ?) ON CONFLICT (username) DO NOTHING",
            (DEFAULT_USER["name"], DEFAULT_USER["username"], hash_password(DEFAULT_USER["password"])),
        )


# ---------- helpers ----------

PUBLIC_USER_FIELDS = ("id", "name", "username", "lmp_date", "blood_group", "doctor_name", "hospital", "phone")


def public_user(user: dict) -> dict:
    data = {k: user.get(k) for k in PUBLIC_USER_FIELDS}
    if user.get("lmp_date"):
        data["due_date"] = (date.fromisoformat(user["lmp_date"]) + timedelta(days=PREGNANCY_DAYS)).isoformat()
    else:
        data["due_date"] = None
    return data


def pregnancy_status(lmp: date, today: date | None = None) -> dict:
    today = today or date.today()
    due = lmp + timedelta(days=PREGNANCY_DAYS)
    elapsed = (today - lmp).days
    week = elapsed // 7 + 1
    day = elapsed % 7
    clamped_week = max(1, min(40, week))
    return {
        "lmp_date": lmp.isoformat(),
        "due_date": due.isoformat(),
        "days_elapsed": max(0, elapsed),
        "days_left": max(0, (due - today).days),
        "week": clamped_week,
        "day": day if 1 <= week <= 40 else 0,
        "weeks_completed": max(0, min(40, elapsed // 7)),
        "trimester": 1 if clamped_week <= 13 else 2 if clamped_week <= 27 else 3,
        "progress": round(max(0.0, min(1.0, elapsed / PREGNANCY_DAYS)), 4),
        "month": max(1, min(9, elapsed // 30 + 1)),
        "overdue": elapsed > PREGNANCY_DAYS,
        "week_info": get_week(clamped_week),
    }


def owned_or_404(conn, table: str, item_id: int, user_id: int) -> dict:
    row = conn.execute(f"SELECT * FROM {table} WHERE id = ? AND user_id = ?", (item_id, user_id)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")
    return row_to_dict(row)


def health_row(row) -> dict:
    data = row_to_dict(row)
    data["symptoms"] = json.loads(data["symptoms"]) if data.get("symptoms") else []
    return data


def appointment_row(row) -> dict:
    data = row_to_dict(row)
    data["done"] = bool(data["done"])
    return data


# ---------- auth ----------

@app.post("/api/auth/register")
def register(body: RegisterIn):
    with get_conn() as conn:
        if conn.execute("SELECT 1 FROM users WHERE username = ?", (body.username,)).fetchone():
            raise HTTPException(status_code=400, detail="This username is already taken")
        new_id = conn.execute(
            "INSERT INTO users (name, username, password_hash) VALUES (?, ?, ?) RETURNING id",
            (body.name.strip(), body.username, hash_password(body.password)),
        ).fetchone()["id"]
        user = row_to_dict(conn.execute("SELECT * FROM users WHERE id = ?", (new_id,)).fetchone())
    return {"token": create_session(user["id"]), "user": public_user(user)}


@app.post("/api/auth/login")
def login(body: LoginIn):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE username = ?", (body.username.strip().lower(),)).fetchone()
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    user = row_to_dict(row)
    return {"token": create_session(user["id"]), "user": public_user(user)}


@app.post("/api/auth/logout")
def logout(user: dict = Depends(current_user)):
    delete_session(user["token"])
    return {"ok": True}


# ---------- profile ----------

@app.get("/api/me")
def me(user: dict = Depends(current_user)):
    return public_user(user)


@app.put("/api/me")
def update_me(body: ProfileIn, user: dict = Depends(current_user)):
    updates = body.model_dump(exclude_unset=True)
    due = updates.pop("due_date", None)
    if due and not updates.get("lmp_date"):
        updates["lmp_date"] = due - timedelta(days=PREGNANCY_DAYS)
    if "lmp_date" in updates and updates["lmp_date"]:
        lmp = updates["lmp_date"]
        if lmp > date.today():
            raise HTTPException(status_code=400, detail="Last period date can't be in the future")
        if (date.today() - lmp).days > 310:
            raise HTTPException(status_code=400, detail="That date is more than 44 weeks ago")
        updates["lmp_date"] = lmp.isoformat()
    if "name" in updates and not (updates["name"] or "").strip():
        updates.pop("name")

    if updates:
        cols = ", ".join(f"{k} = ?" for k in updates)
        with get_conn() as conn:
            conn.execute(f"UPDATE users SET {cols} WHERE id = ?", (*updates.values(), user["id"]))
    with get_conn() as conn:
        fresh = row_to_dict(conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone())
    return public_user(fresh)


# ---------- pregnancy ----------

@app.get("/api/pregnancy/status")
def get_status(user: dict = Depends(current_user)):
    if not user.get("lmp_date"):
        raise HTTPException(status_code=409, detail="Pregnancy details not set up yet")
    return pregnancy_status(date.fromisoformat(user["lmp_date"]))


@app.get("/api/weeks")
def all_weeks():
    return list(WEEKS.values())


@app.get("/api/weeks/{week}")
def one_week(week: int):
    if week < 1 or week > 40:
        raise HTTPException(status_code=404, detail="Week must be between 1 and 40")
    return get_week(week)


# ---------- health logs ----------

@app.get("/api/health-logs")
def list_logs(user: dict = Depends(current_user)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM health_logs WHERE user_id = ? ORDER BY log_date DESC, id DESC", (user["id"],)
        ).fetchall()
    return [health_row(r) for r in rows]


@app.post("/api/health-logs", status_code=201)
def add_log(body: HealthLogIn, user: dict = Depends(current_user)):
    with get_conn() as conn:
        new_id = conn.execute(
            """INSERT INTO health_logs
               (user_id, log_date, weight, systolic, diastolic, water_glasses, mood, symptoms, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""",
            (
                user["id"], body.log_date.isoformat(), body.weight, body.systolic, body.diastolic,
                body.water_glasses, body.mood, json.dumps(body.symptoms), body.notes,
            ),
        ).fetchone()["id"]
        row = conn.execute("SELECT * FROM health_logs WHERE id = ?", (new_id,)).fetchone()
    return health_row(row)


@app.delete("/api/health-logs/{log_id}")
def delete_log(log_id: int, user: dict = Depends(current_user)):
    with get_conn() as conn:
        owned_or_404(conn, "health_logs", log_id, user["id"])
        conn.execute("DELETE FROM health_logs WHERE id = ?", (log_id,))
    return {"ok": True}


# ---------- appointments ----------

@app.get("/api/appointments")
def list_appointments(user: dict = Depends(current_user)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM appointments WHERE user_id = ? ORDER BY date ASC, time ASC", (user["id"],)
        ).fetchall()
    return [appointment_row(r) for r in rows]


@app.post("/api/appointments", status_code=201)
def add_appointment(body: AppointmentIn, user: dict = Depends(current_user)):
    with get_conn() as conn:
        new_id = conn.execute(
            """INSERT INTO appointments (user_id, title, doctor, location, date, time, notes, done)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""",
            (user["id"], body.title, body.doctor, body.location, body.date.isoformat(),
             body.time, body.notes, int(body.done)),
        ).fetchone()["id"]
        row = conn.execute("SELECT * FROM appointments WHERE id = ?", (new_id,)).fetchone()
    return appointment_row(row)


@app.put("/api/appointments/{appt_id}")
def update_appointment(appt_id: int, body: AppointmentIn, user: dict = Depends(current_user)):
    with get_conn() as conn:
        owned_or_404(conn, "appointments", appt_id, user["id"])
        conn.execute(
            """UPDATE appointments SET title = ?, doctor = ?, location = ?, date = ?, time = ?,
               notes = ?, done = ? WHERE id = ?""",
            (body.title, body.doctor, body.location, body.date.isoformat(), body.time,
             body.notes, int(body.done), appt_id),
        )
        row = conn.execute("SELECT * FROM appointments WHERE id = ?", (appt_id,)).fetchone()
    return appointment_row(row)


@app.delete("/api/appointments/{appt_id}")
def delete_appointment(appt_id: int, user: dict = Depends(current_user)):
    with get_conn() as conn:
        owned_or_404(conn, "appointments", appt_id, user["id"])
        conn.execute("DELETE FROM appointments WHERE id = ?", (appt_id,))
    return {"ok": True}


# ---------- kick counter ----------

@app.get("/api/kicks")
def list_kicks(user: dict = Depends(current_user)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM kick_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 50", (user["id"],)
        ).fetchall()
    return [row_to_dict(r) for r in rows]


@app.post("/api/kicks", status_code=201)
def add_kicks(body: KickSessionIn, user: dict = Depends(current_user)):
    with get_conn() as conn:
        new_id = conn.execute(
            "INSERT INTO kick_sessions (user_id, started_at, duration_seconds, kicks) VALUES (?, ?, ?, ?) RETURNING id",
            (user["id"], body.started_at, body.duration_seconds, body.kicks),
        ).fetchone()["id"]
        row = conn.execute("SELECT * FROM kick_sessions WHERE id = ?", (new_id,)).fetchone()
    return row_to_dict(row)


@app.delete("/api/kicks/{kick_id}")
def delete_kicks(kick_id: int, user: dict = Depends(current_user)):
    with get_conn() as conn:
        owned_or_404(conn, "kick_sessions", kick_id, user["id"])
        conn.execute("DELETE FROM kick_sessions WHERE id = ?", (kick_id,))
    return {"ok": True}


@app.get("/api/health")
def healthcheck():
    return {"status": "ok"}

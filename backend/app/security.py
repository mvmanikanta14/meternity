import hashlib
import hmac
import secrets

from fastapi import Header, HTTPException

from .database import get_conn, row_to_dict

ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), ITERATIONS).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), ITERATIONS).hex()
    return hmac.compare_digest(check, digest)


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with get_conn() as conn:
        conn.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
    return token


def delete_session(token: str) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def _extract_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return authorization.split(" ", 1)[1].strip()


def current_user(authorization: str | None = Header(default=None)) -> dict:
    token = _extract_token(authorization)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?",
            (token,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    user = row_to_dict(row)
    user["token"] = token
    return user

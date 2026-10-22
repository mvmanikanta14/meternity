import re
from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=6, max_length=128)

    @field_validator("username")
    @classmethod
    def normalise_username(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.fullmatch(r"[a-z0-9._]{3,30}", v):
            raise ValueError("Username can use only letters, numbers, dot and underscore (3-30 characters)")
        return v


class LoginIn(BaseModel):
    username: str
    password: str


class ProfileIn(BaseModel):
    name: Optional[str] = Field(default=None, max_length=80)
    lmp_date: Optional[date] = None
    due_date: Optional[date] = None  # alternative to lmp_date
    blood_group: Optional[str] = Field(default=None, max_length=5)
    doctor_name: Optional[str] = Field(default=None, max_length=80)
    hospital: Optional[str] = Field(default=None, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=20)


class HealthLogIn(BaseModel):
    log_date: date
    weight: Optional[float] = Field(default=None, gt=20, lt=250)
    systolic: Optional[int] = Field(default=None, gt=50, lt=250)
    diastolic: Optional[int] = Field(default=None, gt=30, lt=180)
    water_glasses: Optional[int] = Field(default=None, ge=0, le=30)
    mood: Optional[str] = Field(default=None, max_length=20)
    symptoms: list[str] = []
    notes: Optional[str] = Field(default=None, max_length=500)


class AppointmentIn(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    doctor: Optional[str] = Field(default=None, max_length=80)
    location: Optional[str] = Field(default=None, max_length=120)
    date: date
    time: Optional[str] = Field(default=None, max_length=10)
    notes: Optional[str] = Field(default=None, max_length=500)
    done: bool = False


class KickSessionIn(BaseModel):
    started_at: str
    duration_seconds: int = Field(ge=0, le=60 * 60 * 6)
    kicks: int = Field(ge=0, le=500)

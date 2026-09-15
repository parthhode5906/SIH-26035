"""Seed script: demo users + a Table-3-valid Class III instrument.

Usage:
    cd backend
    ./.venv/Scripts/python -m scripts.seed
"""

from __future__ import annotations

from decimal import Decimal

from src.db.database import SessionLocal, create_all
from src.db.models import Instrument
from src.services.instrument_service import create_instrument
from src.services.user_service import seed_demo_users


def main() -> None:
    create_all()
    db = SessionLocal()
    try:
        users = seed_demo_users(db, password="demo-password-2026")
        admin = next(u for u in users if u.role.value == "admin")
        existing = db.query(Instrument).filter_by(serial_number="EMS-9101-X").first()
        if existing is None:
            create_instrument(
                db,
                manufacturer="Essae Digitronics",
                model="DS-415",
                serial_number="EMS-9101-X",
                accuracy_class="III",
                max_capacity=Decimal("15"),
                min_capacity=Decimal("0.1"),
                verification_scale_interval=Decimal("0.005"),
                display_interval=Decimal("0.001"),
                base_unit="kg",
                created_by=admin.id,
            )
        print("seeded: 3 users (demo-password-2026) + 1 Class III instrument")
    finally:
        db.close()


if __name__ == "__main__":
    main()

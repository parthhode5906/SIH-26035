# Deployment (P7-2)

Three-service compose stack: **Postgres 16** (durable), **FastAPI backend**,
**nginx-served PWA frontend** (which also proxies `/api`).

## Prereqs

- Docker Engine + Compose v2 (`docker compose version`)
- TLS termination in production sits in front of `frontend:80` (reverse
  proxy / cloud LB) — terminate HTTPS there and forward to port 8080.

## First deployment

```bash
cd deploy
cp .env.example .env            # then EDIT .env — generate real secrets
python -c "import secrets; print(secrets.token_urlsafe(48))"   # for JWT_SECRET_KEY
docker compose up --build -d
docker compose ps               # all three healthy
curl http://localhost:8080/health   # via nginx proxy → backend
```

Create the first users (inside the backend container):

```bash
docker compose exec backend python -m scripts.seed
```

Then log in at `http://localhost:8080` and change demo passwords
(user management is admin-only).

## Data durability & backup

| Volume | Content | Backup |
|---|---|---|
| `pgdata` | all relational data | nightly `pg_dump` (see below) |
| `reports` | sealed PDF/DOCX artifacts | rsync/tar — checksums in DB must match files |
| `uploads` | attachments/photos | rsync/tar |

```bash
# Nightly logical backup (cron)
docker compose exec -T db pg_dump -U oiml oiml | gzip > backup-$(date +%F).sql.gz
```

**Report integrity:** the DB stores each report's SHA-256; a restore must
keep `reports/` and `pgdata` consistent. After any restore, run the public
verify endpoint (`/verify/:reportId`) on a sample of reports — a mismatch
means the artifact volume and DB diverged.

## Environment matrix

| Variable | Dev default | Production requirement |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./oiml_dev.db` | Postgres URL (compose sets it) |
| `JWT_SECRET_KEY` | `dev-only-secret-change-me` | 48+ random bytes — **mandatory** |
| `ENVIRONMENT` | `development` | `production` (audit failures become fatal) |
| `CORS_ALLOW_ORIGINS` | loopback dev origins | your real origin(s), comma-separated |
| `REPORT_VERIFY_BASE_URL` | `http://localhost:5173` | public HTTPS origin (QR targets) |
| `REPORTS_DIR` / `UPLOADS_DIR` | `./backend/reports`, `./backend/uploads` | named volumes (compose sets them) |

## Known hardening follow-ups

- ~~Run `alembic upgrade head` as part of production rollout~~ DONE: the
  backend container now runs `alembic upgrade head` on every boot
  (backend.Dockerfile CMD); the migration chain is the production schema
  path. Development still uses `create_all()` for convenience.
- Rate-limit `/api/v1/public/verify/*` at the reverse proxy.
- DB-trigger enforcement of the append-only guarantees on
  `observations` and `audit_log` (application code already never updates
  them; triggers make it impossible even with raw DB access).

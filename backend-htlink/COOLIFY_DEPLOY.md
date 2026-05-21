# Coolify Deploy Notes

This repository is now organized so the default `docker-compose.yml` is safe for production-style deployment, while local hot-reload work should use `docker-compose.dev.yml`.

## Recommended deployment mode

For Coolify, prefer two separate services:

- Backend service from `/backend/Dockerfile`
- Frontend service from `/frontend/Dockerfile`

This avoids coupling frontend build-time API settings to an internal Docker hostname.

## Backend Coolify settings

- `Build Pack`: `Dockerfile`
- `Base Directory`: `/`
- `Dockerfile Location`: `/backend/Dockerfile`
- `Ports Exposes`: `8000`

Set backend environment variables in Coolify, not in git-tracked files.

Minimum backend variables:

- `ENVIRONMENT=production`
- `PORT=8000`
- `RUN_ALEMBIC_MIGRATIONS=false`
- `FRONTEND_HOST=https://your-frontend-domain.com`
- `BACKEND_CORS_ORIGINS=["https://your-frontend-domain.com","https://your-backend-domain.com"]`
- `MYSQL_SERVER=<your mysql host>`
- `MYSQL_PORT=3306`
- `MYSQL_DATABASE=<your db name>`
- `MYSQL_USER=<your db user>`
- `MYSQL_PASSWORD=<your db password>`
- `SECRET_KEY=<strong secret>`
- `FIRST_SUPERUSER=<admin email>`
- `FIRST_SUPERUSER_PASSWORD=<admin password>`
- `PROJECT_NAME=VR Restaurant`

## Frontend Coolify settings

- `Build Pack`: `Dockerfile`
- `Base Directory`: `/`
- `Dockerfile Location`: `/frontend/Dockerfile`
- `Ports Exposes`: `80`

Frontend build argument:

- `VITE_API_URL=https://your-backend-domain.com`

The frontend production image is served by nginx and does not require the Vite dev server.

## Local usage

- Production-style local run: `docker compose up -d --build`
- Local hot reload: `docker compose -f docker-compose.dev.yml up -d --build`

## Backend startup flow

The backend container starts with:

1. `scripts/prestart.sh`
2. database connectivity check
3. optional Alembic migration when `RUN_ALEMBIC_MIGRATIONS=true`
4. `uvicorn app.main:app`

By default, production startup skips Alembic migrations to avoid replaying migrations against an existing live database.

## Healthcheck

- Container healthcheck: `/health`
- App endpoint: `GET /health`

## Important note

The VR360 scenes table is currently provisioned by the SQL script at `backend/migrations/add_vr360_scenes_table.sql`. Make sure that table already exists in the target production database before enabling VR360 settings in a freshly deployed environment.

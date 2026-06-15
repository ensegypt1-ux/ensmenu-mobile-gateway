# Ensmenu Mobile Gateway

HTTP proxy gateway for the Flutter Owner App. Forwards requests to the Express backend at `/api/owner/*`.

**No database connection.** All secrets stay in this service's environment only.

## Architecture

```
Flutter  →  NestJS Gateway  →  Express /api/owner/*
           /owner/* (alias)
           /mobile/v1/* (canonical)
```

## Quick start

```bash
cd ensmenu-mobile-gateway
npm install
cp .env.example .env
npm run start:dev
```

Gateway listens on `PORT` (default **3001**).

## Environment

See [`.env.example`](.env.example). Required variables:

| Variable | Purpose |
|----------|---------|
| `ENS_BACKEND_URL` | Express backend base (e.g. `https://ensapi.ensbot.net`) |
| `SECRET_KEY` | Same as backend `SECRET_KEY` / `ENCRYPTION_KEY` — gateway generates `x-api-key` for `/api/*` |
| `ASSET_PUBLIC_BASE_URL` | Rewrite `/uploads/*` URLs in JSON responses |
| `CORS_ORIGINS` | Allowed origins (`*` for local dev) |

**Upstream note:** The deployed backend (`ens-new-menu-back-main`) exposes legacy routes under `/api/*` (e.g. `POST /api/auth/login`), **not** `/api/owner/*`. All `/api/*` routes (except public paths) require server-side `x-api-key`, which the gateway injects using `SECRET_KEY`.

**Not used:** `DB_*` — gateway never connects to SQL Server.

## Flutter Phase 1 migration

Change **only** `API_BASE_URL`. Keep existing `/owner/*` repository paths.

```dart
// lib/config/env.dart
const String kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:3001',
);
```

Run commands:

```bash
# Android emulator → host machine
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001

# iOS simulator / desktop
flutter run --dart-define=API_BASE_URL=http://localhost:3001

# Production gateway
flutter run --dart-define=API_BASE_URL=https://mobile-api.ensmenu.com
```

**Important:** Flutter's old default was `https://ensapi.ensbot.net/api` (with `/api` suffix). The gateway base URL has **no** `/api` suffix — paths start with `/owner/...`.

## Route map

| Flutter (Phase 1) | Canonical | Upstream (actual backend) |
|-------------------|-----------|---------------------------|
| `POST /owner/auth/login` | `POST /mobile/v1/auth/login` | `POST /api/auth/login` + `x-api-key` |
| `GET /owner/menus` | `GET /mobile/v1/menus` | `GET /api/menus` + `x-api-key` |
| `POST /owner/upload` | `POST /mobile/v1/upload` | `/api/owner/upload` |
| `POST /owner/menus/:id/import` | `POST /mobile/v1/menus/:id/import/analyze` | `/api/owner/menus/:id/import` |
| `GET /owner/user/subscription` | `GET /mobile/v1/user/subscription` | `/api/owner/user/subscription` |

`/owner/*` aliases are temporary migration compatibility. `/mobile/v1/*` is canonical.

## Smoke tests (curl)

Replace `<token>` with a valid owner JWT.

```bash
# Health
curl http://localhost:3001/health

# Login — alias path (Flutter Phase 1)
curl -X POST http://localhost:3001/owner/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","password":"your-password"}'

# Login — canonical path
curl -X POST http://localhost:3001/mobile/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","password":"your-password"}'

# Session
curl http://localhost:3001/owner/auth/me \
  -H "Authorization: Bearer <token>"

# Menus
curl http://localhost:3001/owner/menus?locale=en \
  -H "Authorization: Bearer <token>"

# Subscription (CreateMenu limits)
curl http://localhost:3001/owner/user/subscription \
  -H "Authorization: Bearer <token>"

# Activity logs (hub)
curl "http://localhost:3001/owner/menus/1/activity-logs?page=1&limit=5" \
  -H "Authorization: Bearer <token>"

# Upload
curl -X POST http://localhost:3001/owner/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@./logo.webp" -F "type=logos"

# Import analyze (alias — matches Flutter today)
curl -X POST http://localhost:3001/owner/menus/1/import \
  -H "Authorization: Bearer <token>" \
  -F "file=@./menu.jpg" -F "locale=en"

# Customizations
curl http://localhost:3001/owner/menus/1/customizations \
  -H "Authorization: Bearer <token>"
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Development with watch |
| `npm run build` | Compile TypeScript |
| `npm run start:prod` | Run compiled build |

## Out of scope (MVP)

Payments, VerifyKit, WebSocket bridge, staff/tables/orders, analytics, FCM, Redis caching.

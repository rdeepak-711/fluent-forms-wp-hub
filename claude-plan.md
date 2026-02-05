# MVP Plan: Hub-Spoke Fluent Forms Management

## Goal
Connect to 1 WordPress site, pull Fluent Forms submissions via WP REST API (Application Passwords), display in a central dashboard. Manual + automatic sync. Scale to 40 sites later.

## Key Decisions

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| SQLAlchemy Mode | **Synchronous** | Simpler, works natively with Celery |
| Database Sessions | Regular `Session` | Easier to understand and debug |
| FastAPI Endpoints | Regular `def` | Less complexity, sufficient for scale |
| Connection String | `mysql+pymysql://` | Standard sync driver |
| WP Auth | Application Passwords | Built-in to WordPress, no plugins needed |

---

## WordPress REST API Integration

### How It Works

The backend connects to WordPress sites using the **WP REST API** with **Application Passwords** (built into WordPress 5.6+). The flow has three stages:

#### Stage 1: Connect to WordPress Site

- **Auth method:** HTTP Basic Auth over HTTPS
- **Credentials:** WordPress username + Application Password (generated in WP Admin → Users → Application Passwords)
- **Storage:** Credentials stored encrypted at rest in the `sites` table (`api_key` = WP username, `api_secret` = Application Password)
- **HTTP client:** `httpx.Client` with persistent connection pooling, 10s timeout
- **Auth header:** `Authorization: Basic base64(username:app_password)`

#### Stage 2: Verify WordPress Connection

- **Endpoint:** `GET {site_url}/wp-json/wp/v2/users/me`
- **Purpose:** Validates credentials are correct and the WP REST API is accessible
- **Success:** Returns the authenticated user's WP profile (confirms auth works)
- **Failure modes:**
  - `401 Unauthorized` → Invalid credentials (wrong username or Application Password)
  - `ConnectError` → Site unreachable (wrong URL, DNS failure, firewall)
  - `TimeoutException` → Site too slow or unresponsive
  - `404` → WP REST API disabled or permalink issue

#### Stage 3: Connect to Fluent Forms Plugin

Once WordPress auth is verified, the backend talks to the **Fluent Forms REST API namespace**:

**Fetch all forms:**
- **Endpoint:** `GET {site_url}/wp-json/fluentform/v1/forms`
- **Returns:** List of all Fluent Forms on the site (id, title, status, etc.)
- **If 404:** Fluent Forms plugin is not installed or not active

**Fetch form submissions (entries):**
- **Endpoint:** `GET {site_url}/wp-json/fluentform/v1/forms/{form_id}/entries`
- **Returns:** All submitted entries for a specific form
- **Entry fields used:**
  - `entry.id` → stored as `fluent_form_id` (unique identifier per site)
  - `entry.status` → stored as `status` (default: "pending")
  - `entry.response` → stored as `data` (JSON dict of form field values)
  - `entry.created_at` → stored as `submitted_at` (parsed via `dateutil`)

### Sync Data Flow (End-to-End)

```
User clicks "Sync Now"  OR  Celery Beat triggers every 2 hours
    │
    ▼
POST /api/v1/sync/{site_id}  (or sync all sites)
    │
    ▼
WordPressClient.test_connection()
    → GET /wp-json/wp/v2/users/me
    → If fail: return error immediately
    │
    ▼
WordPressClient.get_forms()
    → GET /wp-json/fluentform/v1/forms
    → Returns list of forms with IDs
    │
    ▼
For each form:
    WordPressClient.get_form_entries(form_id)
        → GET /wp-json/fluentform/v1/forms/{id}/entries
        → If fail: log warning, skip to next form
        │
        ▼
    For each entry:
        → Lookup by (site_id, fluent_form_id) in local DB
        → If exists: UPDATE status + data
        → If new: INSERT new Submission record
        → Flush to DB every 500 records (batch optimization)
    │
    ▼
Commit all changes + update site.last_synced_at
    │
    ▼
Return SiteSyncResponse { site_id, forms_found, submissions_synced, status, message }
```

### WordPress Site Requirements

For a site to work with this system:
1. WordPress 5.6+ (for Application Passwords support)
2. Fluent Forms plugin installed and activated
3. WP REST API enabled (default — some security plugins disable it)
4. HTTPS recommended (Basic Auth sends credentials in headers)
5. Application Password created for the connecting user (WP Admin → Users → Edit → Application Passwords)

---

## COMPLETED (Prior Work)

- [x] Project structure & configuration files
- [x] `requirements.txt`, `.env`, `.env.example`, `alembic.ini`
- [x] `backend/app/main.py` — FastAPI entry point
- [x] `backend/app/core/config.py` — Pydantic settings
- [x] `backend/app/core/database.py` — SQLAlchemy engine, SessionLocal, Base
- [x] `backend/app/core/security.py` — JWT + bcrypt
- [x] `backend/app/models/` — All 7 tables (user, site, submission, email_thread, audit_log)
- [x] `backend/app/schemas/user.py` — UserCreate, UserResponse, Token, TokenPayload
- [x] `backend/app/schemas/submission.py` — SubmissionCreate, SubmissionResponse, SubmissionUpdate
- [x] `backend/app/schemas/email.py` — EmailCreate, EmailResponse
- [x] `backend/app/api/deps.py` — get_db, get_current_user
- [x] `backend/app/api/v1/auth.py` — JWT login endpoint
- [x] `backend/app/api/v1/submission.py` — Submissions CRUD
- [x] `backend/app/api/v1/email.py` — Emails CRUD
- [x] `backend/scripts/create_admin.py` — Admin user creation
- [x] `backend/scripts/seed_db.py` — Test data seeding
- [x] Alembic initialized (`alembic/env.py`)

---

## Phase 1: Backend Model & Schema Fixes

### Task 1.1 — Add `last_synced_at` to Site model
- [x] Modify `backend/app/models/site.py`
- [x] Add `last_synced_at = Column(DateTime(timezone=True), nullable=True)` to `Site`
- [x] Confirm `api_key` = WP username, `api_secret` = WP Application Password (no rename)

### Task 1.2 — Add `submitted_at` default to Submission model
- [x] Modify `backend/app/models/submission.py`
- [x] Add `default=lambda: datetime.now(timezone.utc)` to `submitted_at` column
- [x] Add `from datetime import datetime, timezone` import if missing

### Task 1.3 — Create Site schemas
- [x] Create `backend/app/schemas/site.py`
- [x] Define `SiteCreate` schema (name, url, api_key, api_secret)
- [x] Define `SiteUpdate` schema (all fields optional)
- [x] Define `SiteResponse` schema (excludes api_key/api_secret for security)
- [x] Define `SiteSyncResponse` schema (site_id, forms_found, submissions_synced, status, message)

### Task 1.4 — Update schema exports
- [x] Modify `backend/app/schemas/__init__.py`
- [x] Add imports for all site schemas (SiteCreate, SiteUpdate, SiteResponse, SiteSyncResponse)

---

## Phase 2: WordPress Service

### Task 2.1 — Implement WordPressClient
- [x] Modify `backend/app/services/wordpress.py` (currently empty stub)
- [x] Implement `__init__(self, site_url, wp_username, app_password)` — store URL, build Base64 Basic Auth header
- [x] Use `httpx.Client` with persistent connection pooling + context manager for cleanup
- [x] **Stage 1 — Connect to WP:** `test_connection()` → `GET {url}/wp-json/wp/v2/users/me` (validates auth)
- [x] **Stage 2 — Fetch forms:** `get_forms()` → `GET {url}/wp-json/fluentform/v1/forms` (lists all forms)
- [x] **Stage 3 — Fetch entries:** `get_form_entries(form_id)` → `GET {url}/wp-json/fluentform/v1/forms/{id}/entries`
- [x] Handle: `TimeoutException`, `ConnectError`, `HTTPStatusError` (401/404), `JSONDecodeError`
- [x] All methods return `{"success": bool, "data": ..., "error": ...}` structured response

---

## Phase 3: Site Management + Sync API

### Task 3.1 — Site CRUD endpoints
- [x] Create `backend/app/api/v1/site.py`
- [x] Implement `GET /sites/` — list all active sites
- [x] Implement `GET /sites/{id}` — get single site by ID
- [x] Implement `POST /sites/` — create new site
- [x] Implement `PUT /sites/{id}` — update existing site
- [x] Implement `DELETE /sites/{id}` — soft-delete (set `is_active=False`)
- [x] Implement `POST /sites/{id}/test-connection` — verify WP credentials via WordPressClient

### Task 3.2 — Sync endpoints + core sync logic
- [x] Create `backend/app/api/v1/sync.py`
- [x] Implement `sync_site_submissions(db, site)` shared function
- [x] Fetch forms list via `WordPressClient.get_forms()`
- [x] For each form, fetch entries via `WordPressClient.get_form_entries(form_id)`
- [x] Upsert submissions by `(site_id, fluent_form_id)` unique constraint
- [x] Update `site.last_synced_at` after successful sync
- [x] Implement `POST /sync/{site_id}` — manual sync for one site
- [x] Implement `POST /sync/` — manual sync for all active sites

### Task 3.3 — Add site_id filtering to submissions
- [x] Modify `backend/app/api/v1/submission.py`
- [x] Add `site_id: int = None` query param to GET `/submissions/`
- [x] Add `status: str = None` query param to GET `/submissions/`
- [x] Add `GET /submissions/{id}` endpoint for single submission
- [x] Order results by `submitted_at desc`

### Task 3.4 — Register new routers
- [x] Modify `backend/app/api/v1/__init__.py`
- [x] Import and include site router at prefix `/sites`
- [x] Import and include sync router at prefix `/sync`

### Task 3.5 — Add CORS middleware
- [x] Modify `backend/app/main.py`
- [x] Add `CORSMiddleware` with `allow_origins=["http://localhost:5173"]`
- [x] Allow credentials, methods, and headers

---

## Phase 4: Celery Auto-Sync

### Task 4.1 — Celery config
- [x] Create `backend/app/tasks/celery_app.py`
- [x] Configure Celery app with Redis broker URL from settings
- [x] Define beat schedule: sync all sites every 2 hours
- [x] Set explicit timezone (UTC), enable_utc, result_expires

### Task 4.2 — Sync tasks
- [x] Create `backend/app/tasks/sync_tasks.py`
- [x] Implement `sync_all_sites()` task — iterate active sites, call `sync_site_submissions`
- [x] Implement `sync_single_site(site_id)` task — sync one site by ID
- [x] Reuse `sync_site_submissions` from `backend/app/api/v1/sync.py`
- [x] Add proper logging (replaced print with logger)
- [x] Add retry config (autoretry_for, retry_backoff, max_retries=3, retry_jitter)
- [x] Create `backend/app/tasks/__init__.py` (package file)

### Task 4.3 — Update main.py
- [x] Import Celery app in `backend/app/main.py`
- [x] Add `/health` endpoint that returns `{"status": "ok"}`
- [x] Guard startup sync with try/except (broker may not be ready)

---

## Phase 5: Docker Compose

### Task 5.1 — Backend Dockerfile
- [x] Create `backend/Dockerfile`
- [x] Base image: `python:3.12-slim`
- [x] Copy and install `requirements.txt`
- [x] CMD: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- [x] Layer caching (COPY requirements.txt first, then app code)
- [x] `--no-cache-dir` on pip install
- [x] Non-root user (appuser)
- [x] Create `backend/.dockerignore` (.env, __pycache__, .git, venv)

### Task 5.2 — Docker Compose
- [x] Create `docker-compose.yml` in project root
- [x] Add `mysql:8.0` service with healthcheck and `mysql_data` volume
- [x] Add `redis:7-alpine` service with healthcheck and `redis_data` volume
- [x] Add `api` service (FastAPI via uvicorn, depends on mysql + redis with service_healthy)
- [x] Add `celery-worker` service (depends on db + redis with service_healthy)
- [x] Add `celery-beat` service (depends on db + redis with service_healthy)
- [x] Add `frontend` service (Vite dev server on port 5173)
- [x] Configure shared `.env` file for all backend services

---

## Phase 6: Contact Form Service — WP Auth, Diagnostics, Entries API

### Task 6.1 — Change auth to verify against WordPress REST API
> [!NOTE]
> Cancelled: Auth remains local (user/password). Sites manage their own credentials.
- [-] Modify `backend/app/api/v1/auth.py` — replace local email/password login with WP-based auth
- [-] Update login endpoint to accept `wp_url`, `username`, `password` instead of `email`/`password`
- [-] On login, call `GET {wp_url}/wp-json/wp/v2/users/me` with Basic Auth to validate credentials
- [-] On success, find-or-create a local `User` record (for JWT, audit logs, site assignments)
- [-] Auto-create a `Site` entry (or associate user with existing site) on first login
- [-] Modify `backend/app/schemas/user.py` — update `LoginRequest` schema to `{wp_url, username, password}`
- [-] Modify `backend/app/services/wordpress.py` — ensure `test_connection()` can be used for login validation

### Task 6.2 — Add `contact_form_id` to Site model
- [x] Modify `backend/app/models/site.py` — add `contact_form_id = Column(Integer, nullable=True)`
- [x] Modify `backend/app/schemas/site.py` — add `contact_form_id: Optional[int]` to `SiteCreate` and `SiteUpdate`
- [x] Create Alembic migration for the new column

### Task 6.3 — Add WP diagnostics methods to `WordPressClient`
- [x] Add `check_wp_reachable()` — `GET {wp}/wp-json/` (sanity check site is up)
- [x] Add `check_fluentforms_api()` — `GET {wp}/wp-json/fluentform/v1` (REST routes registered)
- [x] Add `get_plugin_status()` — `GET {wp}/wp-json/wp/v2/plugins?search=fluentform&context=edit` (plugin installed + active)
- [x] All methods in `backend/app/services/wordpress.py`

### Task 6.4 — Create WP diagnostics endpoint
- [x] Create `backend/app/api/v1/diagnostics.py`
- [x] Implement `GET /diagnostics/{site_id}` — runs all three checks in sequence
- [x] Return structured response: `{ wordpress: { reachable }, fluentforms: { installed, active, version, message } }`
- [x] Create `WPDiagnosticsResponse` schema in `backend/app/schemas/site.py` (or new file)
- [x] Register router in `backend/app/api/v1/__init__.py`

### Task 6.5 — Create contact form resolver endpoint

- [x] Create `backend/app/api/v1/contact.py`
- [x] Implement `GET /sites/{site_id}/contact-form` — resolves the contact form
- [x] If `site.contact_form_id` is set → find form by ID from WP API
- [x] Else → case-insensitive title match against `["contact", "contact us"]`
- [x] Return `{ form_id, title }` or 404 with "No Contact form found"
- [x] Create `ContactFormResponse` schema

### Task 6.6 — Create contact form entries endpoint (normalized output)
- [x] Implement `GET /sites/{site_id}/contact-form/entries` in `backend/app/api/v1/contact.py`
- [x] Resolve contact form (reuse Task 6.5 logic)
- [x] Fetch entries from WP: `GET {wp}/wp-json/fluentform/v1/forms/{id}/entries`
- [x] Parse each entry's `response` JSON to extract `name`, `email`, `subject`, `message`
- [x] Attach metadata: `created_at`, `source_url`, `status`, `ip`, `browser`, `device`
- [x] Support pagination: `?page=1&per_page=15`
- [x] Return normalized shape: `{ form: {id, title}, pagination: {...}, entries: [...] }`
- [x] Create `ContactFormEntryResponse` and `ContactFormEntriesListResponse` schemas

### Task 6.7 — Add parsed columns to Submission model
- [x] Modify `backend/app/models/submission.py` — add `submitter_name`, `submitter_email`, `subject`, `message` columns
- [x] Modify `backend/app/schemas/submission.py` — add new fields to response schema
- [x] Create Alembic migration for the new columns
- [x] Keep `data` column as raw JSON backup

### Task 6.8 — Update sync logic to scope to contact forms + parse fields
- [x] Modify `backend/app/api/v1/sync.py` — when `site.contact_form_id` is set, sync only that form
- [x] When `contact_form_id` is not set, use title-match fallback to find the contact form
- [x] During sync, parse `response` JSON and populate `submitter_name`, `submitter_email`, `subject`, `message`
- [x] Modify `backend/app/tasks/sync_tasks.py` — update Celery tasks to use scoped sync logic

### Task 6.9 — Add paginated entry fetching to `WordPressClient`
- [x] Add `get_form_entries_paginated(form_id, page, per_page)` to `backend/app/services/wordpress.py`
- [x] Return paginated results with total count, per_page, current_page, last_page

### Task 6.10 — Register new routers
- [x] Modify `backend/app/api/v1/__init__.py`
- [x] Import and include diagnostics router at prefix `/diagnostics`
- [x] Import and include contact router at prefix `/sites` (nested under site)

### Task 6.11 — Add HTTP-level timeouts and retries
- [x] Modify `backend/app/services/wordpress.py` — make timeout configurable (default 10s)
- [x] Add retry logic with exponential backoff at the HTTP client level (using `httpx` or `tenacity`)
- [x] Handle transient failures gracefully across all WP API calls

### Task 6.12 — Add Redis caching for form_id lookup
- [x] Cache the resolved `contact_form_id` per site in Redis (TTL ~1 hour)
- [x] If cached ID exists, skip `get_forms()` and call `get_form_entries(id)` directly
- [x] If not cached, fetch forms, find "Contact Form", and cache the ID
- [x] Add cache utility in `backend/app/services/` or `backend/app/core/`

---

## Phase 7: Gmail-like Frontend (React 19 + Vite 7 + TypeScript + Tailwind CSS v4)

Design: Gmail-style interface with left sidebar (sites), main inbox (submissions list), detail view with email thread, and floating compose popup for replies. **Bottom-up build order — login page is the last task.**

### File Tree (17 new/modified files)

```
frontend/src/
  types/index.ts                # TypeScript interfaces mirroring backend schemas
  api/
    client.ts                   # Axios instance + Bearer token interceptor
    auth.ts                     # login() — POST /auth/login/access-token
    sites.ts                    # getSites() — GET /sites/
    submissions.ts              # getSubmissions(), getSubmission(), updateSubmission()
    emails.ts                   # getEmails(), sendEmail()
    sync.ts                     # syncSite(), syncAllSites()
  context/AuthContext.tsx        # AuthProvider + useAuth hook (token in localStorage)
  layouts/AppLayout.tsx          # Two-panel shell: sidebar (256px) + main content
  components/
    Sidebar.tsx                 # Sites nav with unread badges + sync buttons
    ProtectedRoute.tsx          # Redirects to /login if no token
    EmailThread.tsx             # Email conversation cards (inbound/outbound)
    ComposePopup.tsx            # Gmail-style floating reply window (bottom-right)
  pages/
    SubmissionsList.tsx         # Inbox rows — blue dot, name, subject+preview, date
    SubmissionDetail.tsx        # Full message + email thread + Reply button
    LoginPage.tsx               # Centered card — email + password form
  App.tsx                       # Router setup (rewrite)
  main.tsx                      # Add AuthProvider wrapper (modify)
  index.css                     # Replace with Tailwind import (modify)
```

Delete: `src/App.css`

---

### Task 7.1 — Install Dependencies & Configure Build

- [x] Run `npm install react-router-dom axios`
- [x] Run `npm install -D tailwindcss @tailwindcss/vite`
- [x] Modify `frontend/vite.config.ts`:
  - Add `tailwindcss()` plugin from `@tailwindcss/vite`
  - Add `server.proxy`: forward `/api` → `http://localhost:8000` (avoids CORS in dev)
- [x] Modify `frontend/src/index.css`: replace contents with `@import "tailwindcss";`
- [x] Delete `frontend/src/App.css`
- [x] Modify `frontend/index.html`: change `<title>` to `Fluent Forms Hub`
- **Verify**: `npm run dev` starts, Tailwind classes work, `/api/health` proxies to backend

---

### Task 7.2 — TypeScript Types

- [x] Create `frontend/src/types/index.ts`
- [x] Define interfaces:
  - `LoginCredentials` — `{username: string, password: string}`
  - `AuthTokens` — `{access_token, refresh_token, token_type}`
  - `Site` — `{id, name, url, is_active, last_synced_at, contact_form_id}`
  - `Submission` — `{id, site_id, fluent_form_id, form_id, status, data, is_read, submitted_at, submitter_name, submitter_email, subject, message, locked_by, locked_at}`
  - `SubmissionUpdate` — `{status?, is_read?}`
  - `Email` — `{id, submission_id, subject, body, direction, to_email, from_email, status, message_id, user_id, created_at}`
  - `EmailCreate` — `{submission_id, body, subject?, direction?}`
  - `SyncResult` — `{site_id, forms_found, submissions_synced, status, message}`

---

### Task 7.3 — API Client Service Layer

- [x] Create `frontend/src/api/client.ts` — Axios instance:
  - Base URL: `/api/v1` (proxied by Vite in dev)
  - Request interceptor: attach `Authorization: Bearer <token>` from `localStorage`
  - Response interceptor: on 401/403, clear tokens + `window.location.href = '/login'`
- [x] Create `frontend/src/api/auth.ts`:
  - `login(username, password)` → POST `/auth/login/access-token?username=X&password=Y` (query params, matching backend `Depends()`)
- [x] Create `frontend/src/api/sites.ts`:
  - `getSites()` → GET `/sites/`
- [x] Create `frontend/src/api/submissions.ts`:
  - `getSubmissions(siteId?)` → GET `/submissions/?site_id=X`
  - `getSubmission(id)` → GET `/submissions/{id}`
  - `updateSubmission(id, data)` → PUT `/submissions/{id}`
- [x] Create `frontend/src/api/emails.ts`:
  - `getEmails(submissionId)` → GET `/emails/?submission_id=X`
  - `sendEmail(data)` → POST `/emails/`
- [x] Create `frontend/src/api/sync.ts`:
  - `syncSite(siteId)` → POST `/sync/{siteId}`
  - `syncAllSites()` → POST `/sync/`

---

### Task 7.4 — Layout Shell + Router + Stubs

- [x] Create `frontend/src/layouts/AppLayout.tsx`:
  - `flex h-screen` — sidebar (w-64, border-r) + main (flex-1, `<Outlet />`)
- [x] Rewrite `frontend/src/App.tsx` with router:
  - `/login` → `LoginPage` (public, no layout)
  - `<ProtectedRoute>` wrapping `<AppLayout>`:
    - `/` → redirect to `/inbox`
    - `/inbox` → `SubmissionsList` (all sites)
    - `/site/:siteId` → `SubmissionsList` (filtered by site)
    - `/submission/:submissionId` → `SubmissionDetail`
- [x] Modify `frontend/src/main.tsx`: wrap `<App />` in `<AuthProvider>`
- [x] Create stub files (minimal `<div>` returns) for all components/pages so app compiles:
  - `Sidebar.tsx`, `ProtectedRoute.tsx` (renders `<Outlet />`), `EmailThread.tsx`, `ComposePopup.tsx`
  - `SubmissionsList.tsx`, `SubmissionDetail.tsx`, `LoginPage.tsx`
  - `context/AuthContext.tsx` (no-op provider, reads token from localStorage)
- **Verify**: `npm run dev` shows the layout shell with sidebar placeholder

---

### Task 7.5 — Sites Sidebar

- [x] Replace stub `frontend/src/components/Sidebar.tsx` with full implementation
- [x] Fetch sites via `getSites()` on mount
- [x] For each site, count unread submissions (`getSubmissions(siteId)` → filter `!is_read`)
- [x] Render: App title, "Sync All" button, "All Inboxes" link, Divider, List of Sites (with badges and per-site sync).
- [x] **Verify**: Active site highlighted, sync works (triggers backend paths).
- [x] Render:
  - App title "Fluent Forms Hub" at top
  - "Sync All Sites" button (calls `syncAllSites()`, re-fetches after)
  - "All Inboxes" `NavLink` → `/inbox` with total unread badge
  - Divider
  - Each site as `NavLink` → `/site/{id}` with unread badge
  - Per-site sync button (refresh icon, appears on hover via Tailwind `group`)
- [ ] Active site highlighted with blue background via `NavLink` `isActive`
- **API calls**: `GET /sites/`, `GET /submissions/?site_id=X` (per site), `POST /sync/{siteId}`, `POST /sync/`

---

### Task 7.6 — Submissions List (Inbox View)

- [x] Replace stub `frontend/src/pages/SubmissionsList.tsx`
- [x] Read `siteId` from URL params; if present, filter by site
- [x] Fetch submissions via `getSubmissions(siteId?)`
- [x] Render Gmail-style rows, each with:
  - Blue dot (unread indicator, `w-2.5 h-2.5 bg-blue-600 rounded-full`)
  - Submitter name (bold if unread, 192px fixed width, truncated)
  - Subject + message preview (truncated to ~80 chars, flex-1)
  - Relative date (`formatRelativeDate` — "3 min ago", "5h ago", "Mon", "Jan 15")
- [x] Unread rows: `font-semibold text-gray-900`; read rows: `text-gray-600 bg-gray-50/50`
- [x] On row click:
  1. Call `updateSubmission(id, {is_read: true})` — optimistic local state update
  2. Navigate to `/submission/{id}`
- [x] Re-fetch when `siteId` param changes
### Task 7.6 — Submission Lists & Detail Views

- [x] Create `frontend/src/components/SubmissionTable.tsx` (dumb component):
  - Props: `submissions`, `onRowClick`
  - Columns: Status badge, Subject (bold if unread), Site, Date (relative)
- [x] Implement `frontend/src/pages/SubmissionsList.tsx` (smart page):
  - Fetch based on `siteId` (URL param)
  - If no `siteId`, fetch all sites (parallel) and aggregate
  - Render `SubmissionTable`
- [x] Implement `frontend/src/pages/SubmissionDetail.tsx`:
  - Fetch single submission via `getSubmission(id)`
  - Layout: Left sidebar (Form Data parsed JSON), Right main (Stub `EmailThread`)
- [x] **Verify**: Click sidebar site → table loads. Click row → detail loads.

---

### Task 7.7 — Submission Detail View

- [x] Replace stub `frontend/src/pages/SubmissionDetail.tsx`
- [x] Fetch submission + emails in parallel: `Promise.all([getSubmission(id), getEmails(id)])`
- [x] Mark as read if not already: `updateSubmission(id, {is_read: true})`
- [x] Render:
  - Top toolbar: back arrow (navigate -1), subject title, status badge (color-coded)
  - Original message card: submitter name, email, timestamp, full message body
  - Collapsible raw `data` JSON (`<details>` + `<pre>`)
  - `<EmailThread emails={emails} />` component (with collapsible failed messages)
  - Bottom action bar: "Reply" button → opens `<ComposePopup />`
- [x] `handleEmailSent(newEmail)` callback: appends to local emails array, closes popup
- **API calls**: `GET /submissions/{id}`, `GET /emails/?submission_id=X`, `PUT /submissions/{id}`

---

### Task 7.8 — Email Thread Display

- [ ] Replace stub `frontend/src/components/EmailThread.tsx`
- [ ] Pure display component — receives `emails: Email[]` as props
- [ ] Each email rendered as a card:
  - **Outbound** (admin replies): `border-blue-200 bg-blue-50/50 ml-8` (indented left)
  - **Inbound**: `border-gray-200 bg-white mr-8` (indented right)
  - Header: "You" or sender email → recipient, status badge, timestamp
  - Status badges: sent = green, failed = red
  - Subject (if present) + body with `whitespace-pre-wrap`
- [ ] Section header: "Email Thread (N)"

---

### Task 7.9 — Compose/Reply Popup

- [x] Replace stub `frontend/src/components/ComposePopup.tsx`
- [x] Position: `fixed bottom-0 right-6 w-[480px]` — Gmail-style floating window
- [x] Dark header bar: "New Message" + close (X) button
- [x] Fields:
  - **To**: read-only input, pre-filled with `submission.submitter_email`
  - **Subject**: editable input, defaults to `Re: {submission.subject}`
  - **Body**: textarea (8 rows), placeholder "Write your reply..."
- [x] Send button: calls `sendEmail({submission_id, subject, body, direction: "outbound"})`
  - On success: `onSent(newEmail)` → parent appends to thread, popup closes
  - On failure: inline error message
  - Validation: body must not be empty
- [x] Loading state on send button ("Sending...")
- **API calls**: `POST /emails/`

---

### Task 7.10 — Auth Context + Protected Route

- [ ] Replace stub `frontend/src/context/AuthContext.tsx`:
  - `AuthProvider` wraps entire app (in `main.tsx`)
  - Initializes by reading `access_token` from `localStorage`
  - `login(username, password)` → calls `apiLogin()`, stores both tokens in localStorage + React state
  - `logout()` → clears localStorage + state
  - `useAuth()` hook returns `{token, login, logout, isAuthenticated}`
- [ ] Replace stub `frontend/src/components/ProtectedRoute.tsx`:
  - If `!isAuthenticated` → `<Navigate to="/login" replace />`
  - Else → `<Outlet />`
- [ ] Token expiry: handled by axios 401 interceptor (clears storage, hard-redirects to `/login`)

---

### Task 7.11 — Login Page (LAST STEP)

- [ ] Replace stub `frontend/src/pages/LoginPage.tsx`
- [ ] Centered card on `bg-gray-100` background
- [ ] Title: "Fluent Forms Hub" + subtitle "Sign in to manage submissions"
- [ ] Form fields:
  - Email input (`type="email"`, `autoFocus`, required)
  - Password input (`type="password"`, required)
- [ ] Submit: calls `useAuth().login(email, password)`
  - On success → `navigate('/inbox', {replace: true})`
  - Error handling: 401 = "Incorrect email or password", 429 = "Too many attempts", 400 = "Account inactive"
- [ ] If already authenticated → redirect to `/inbox` immediately
- [ ] Styled: blue submit button, red error banner, `focus:ring-2 focus:ring-blue-500`
- **API calls**: `POST /auth/login/access-token?username=X&password=Y` (via AuthContext)

---

## Phase 8: Finalize

### Task 8.1 — End-to-end verification
- [ ] Start backend (`cd backend && ./start.sh`)
- [ ] Start frontend (`cd frontend && npm run dev`)
- [ ] Open `http://localhost:5173` → redirects to `/login`
- [ ] Login with `admin@hub.local` / `admin@123` → lands on `/inbox`
- [ ] Sidebar shows "My WP Site" with unread count
- [ ] Click site → filtered submissions list
- [ ] Click submission row → detail view with full message
- [ ] Click "Reply" → compose popup opens at bottom-right
- [ ] Type message, click Send → email appears in thread with `status: "sent"`
- [ ] Check Gmail sent folder for the actual delivered email
- [ ] Check `backend/logs/api_*.log` for send confirmation

### Task 8.2 — Mark plan complete
- [ ] Update this file — mark all completed tasks as `[x]`
- [ ] Document any deviations from plan

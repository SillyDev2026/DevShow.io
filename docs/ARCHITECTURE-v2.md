# DevShow v2 architecture

## Separation of concerns

GitHub Pages serves a static client. It can neither execute Node nor store shared accounts. The Node service runs elsewhere, exposes an HTTPS JSON REST API, and writes account content to SQLite. The frontend `src/cloud.js` is the only fetch wrapper, and `config.js` contains only a public API URL.

In demo mode (unset API base), preloaded sample creators/projects and existing local-storage editing remain available. In cloud mode, bootstrap fetches actual accounts and projects. Demo seed users and projects are not copied into production and won't appear as real community statistics.

## Database tables

`users`, `sessions`, `projects`, `likes`, `bookmarks`, `follows`, `comments`, `collections`, `collection_projects`, `build_logs`, `notifications`.

The `projects.creator_id` foreign key provides ownership; cascading foreign keys remove dependent content when records are deleted. Session records store **only SHA-256 token hashes**, not the raw bearer value. Password hashes use a random per-user salt with Node `scrypt`.

## Request lifecycle

1. Browser sends `GET /api/bootstrap` to the configured backend.
2. Backend optionally validates `Authorization: Bearer ...` and fetches account-specific bookmarks/boards and public projects from SQLite.
3. The UI renders the shared feed; account-required operations start a login/register modal.
4. The browser sends validated JSON changes to the API. The API verifies the authenticated user, validates input and persists a committed database write.
5. The UI fetches fresh bootstrap data before redrawing.

## Security design

- Exact origin CORS allowlist via `CORS_ORIGINS`; no blanket CORS wildcard.
- Explicit body size cap (32 KB); no file upload endpoint.
- Basic per-IP request limiting including a more restrictive authentication bucket. Behind a reverse proxy, configure a trusted edge limiter; the API deliberately does not trust arbitrary `X-Forwarded-For` headers.
- Email+password login, scrypt salted hashes, constant-time comparison, random 256-bit session tokens, 30-day session expiration, revocation on logout.
- Bearer sessions stored in browser **sessionStorage**, not cookies, so cross-site GitHub Pages and backend origins work without third-party cookies. SessionStorage reduces persistence of exposed credentials but does not eliminate XSS risk; use HTTPS and keep rendered user content escaped.
- Bound SQL parameters; ownership checks for edit/delete, private collections and build logs.
- http(s)-only external links; UI escapes text before injecting into HTML templates.
- Secrets are not required in frontend code; `config.js` contains only the public URL.

## Operations

Set `DB_PATH` to a directory that survives redeploys, such as a mounted volume. Back up the SQLite file using a supported SQLite backup operation or during maintenance; simply copying an open WAL database may be inconsistent. Production deployments should include monitoring, health checks and reliable off-site backups.

Limitations: unauthenticated project views increment on GET and may be inflated; notifications are fetched at refresh intervals/actions rather than WebSocket push; no account recovery/email verification; no migration manager; bootstrap is capped at 500 projects/creators and 1500 comments, so plan pagination before scaling.

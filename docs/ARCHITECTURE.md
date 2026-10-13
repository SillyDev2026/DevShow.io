# DevShow v2.5 architecture

The website has a deliberately small, dependency-free ES module frontend and a dependency-free runtime backend (built-in Node HTTP server and SQLite). The desktop build adds `esbuild` as a development-only bundler; it is not a production API dependency.

```text
GitHub Pages  ── HTTPS JSON+Bearer token ──> Node API ── prepared SQL ──> SQLite persistent disk
                                                     │
                                                     └── bounded/validated GitHub metadata proxy
Windows EXE   ── 127.0.0.1 private HTTP ──────────────> Same API ──────────> Windows AppData SQLite
```

- `server/security.js`: token hashing (SHA-256 for random session tokens), scrypt password hashes, timing-safe comparison, consistent errors, size limits and per-IP rate limiting.
- `server/projects.js`: scoped public/owner queries. Unlisted is reachable only with the direct link; private requires owner auth. Public lists exclude nonpublic projects. Build logs and comments do not leak through bootstrap.
- `server/api.js`: user and project resource endpoints, notifications and account exports. Existing v2.2 routes remain compatible for SQLite/account continuity.
- `server/index.js`: CORS origin allowlist; explicit allowlist of static frontend assets. It never serves `server/`, tests, docs, `.env` or SQLite to browsers.
- `src/api.js`: HTTPS validation, fetch timeout, Authorization header and browser-tab session tokens.
- `src/components.js`: HTML escaping of user-generated text; safe external links.
- `src/views.js`: deterministic page renderers; no persistence side effects.
- `src/main.js`: UI actions, routing, state refresh and forms.

This project does not claim to be a production-grade auth service. Add mail verification, reporting, recovery, content moderation, automated backups, TLS, server-side observability and distributed rate limiting before opening it broadly.

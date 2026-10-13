# DevShow.io · v3.0

**Latest update:** A permissioned, live collaborative project editor using LuauForge's editor interaction model, saved-document synchronization, revision protection, shared chat, and team invitations.

[Latest v3 changes](docs/RELEASE-v3.md) · [Live site](https://sillydev2026.github.io/DevShow.io/) · [Windows Releases](https://github.com/SillyDev2026/DevShow.io/releases)

> The v3 editor foundation is **not** the entire proposed 41-feature product. See the release notes for verified capabilities and pending work. Shared projects require a hosted HTTPS API; the EXE uses a local database by default.

## Run on a PC

Requires **Node.js 22.13+** (Node 24 or 26 preferred). No npm install needed for the website/API.

```bash
npm start
```

Open `http://localhost:3000`. Your database is `server/data/devshow.sqlite` by default. To run the test suite:

```bash
npm test
```

To build a **Windows .exe** on a supported Node 26 Windows runner:

```bash
npm install
npm run test:desktop
node --build-sea dist/sea-config.json
```

A passing workflow on a `v2.8.*` Git tag attaches `DevShow-Desktop.exe` directly to GitHub Releases. **The source repository and Windows build workflow do not by themselves mean the executable is available.**

## Public hosting without Cloudflare

GitHub Pages hosts the **frontend only**. You need a separately hosted **HTTPS Node API with a persistent disk**, such as a VPS or Railway with persistent storage.

1. Deploy `Dockerfile` using Node 24 and attach a writable, durable volume at `/data`.
2. Configure `PORT=3000`, `DB_PATH=/data/devshow.sqlite`, `CORS_ORIGINS=https://sillydev2026.github.io`.
3. Set `window.DEVSHOW_API_URL = 'https://your-public-api-host.example.com';` in `config.js`.
4. Publish GitHub Pages using `main` → `/(root)`.

There is **no Cloudflare dependency**. Do not commit secrets or upload databases to the GitHub Pages repository. The frontend does not store user account credentials. API bearer tokens are session-scoped in browser storage.

### Production warnings

Public registration is not ready for an unrestricted launch until you add email verification, password reset, abuse reporting/moderation, monitoring, backups, and stronger distributed rate limiting. Host storage must be persistent; ephemeral instances lose SQLite data on restart. Enable TLS at the hosting provider/reverse proxy. A desktop `.exe` provides **private local saving**, not global social sync.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Project layout

```text
index.html, styles.css, config.js   GitHub Pages site
src/main.js                          Application controller & interactions
src/api.js                           Remote API client and token/session handling
src/components.js                    Escaped, reusable HTML components
src/views.js                         Stateless page and form rendering
server/index.js                      HTTP transport and allowlisted assets
server/api.js                        REST endpoints and account/business rules
server/projects.js                   Visibility enforcement and project queries
server/security.js                   Authentication, validation, rate limiting
server/db.js                         SQLite schema + non-destructive migrations
server/github.js                     Safe public GitHub metadata proxy
tools/build-desktop.mjs              Node 26 SEA bundler config
tools/desktop-entry.mjs              Local Windows app entry
.github/workflows/                   CI and tagged Windows Release builds
tests/                               Regression and smoke tests
```

No private .env, database, releases binary or generated `dist/` should be committed.


## v2.5.1 — fluid UI refresh

- The main columns and page gutters scale with the available viewport and container width rather than fixed screen-size boxes. Cards use intrinsic `16/9` covers, and their columns automatically adapt to their container.
- Desktop has a full sidebar, medium screens use an icon-only rail, and phones use a five-column bottom navigation bar with safe-area padding.
- Mobile search opens a full-width accessible field. The Explore page has persistent grid/list layout choices.
- Browse by topic directly from Discover. The recent section no longer repeats highlighted projects.
- Touch targets, forms, dialogs and fonts use rem-based accessible sizing; the dashboard and cards use flexible grids.
- All previous Node.js API routes, SQLite records, and desktop launcher remain unchanged.

For UI regression checks run `node tests/responsive.test.mjs` (static invariants) and `python tools/test-responsive.py` with Python Playwright and Chromium installed.

## v2.6 — Developer community expansion

The latest release adds real public posts, developer groups, private messages, live notifications, profile media/themes/portfolio options, GitHub OAuth sign-in/linking (configuration required), repository source preview and releases, Creator Studio roadmaps/feedback, owner-only analytics, and safe persisted media uploads. The previous v2.5.1 API remains compatible and adds tables non-destructively.

- Run the backend: `npm start` (Node.js 22.13+, SQLite built into Node; no runtime npm dependencies).
- Tests: `npm test`.
- [v2.6 release details](docs/RELEASES-v2.6.md) · [v2.6 hosting and GitHub OAuth](docs/DEPLOYMENT-v2.6.md).
- GitHub OAuth, worldwide synchronization and persistent images require a deployed Node server, durable volume and the environment variables described above. GitHub Pages alone cannot host the backend.
- Uploads are limited to 1 MB PNG/JPEG/WebP; project privacy and message ownership are enforced on the server. SSE is single-process and intended as a lightweight notification channel, not a multiplayer editor.
- Windows packaging is retained but requires the GitHub Windows workflow to generate a current `.exe`; the executable is **not** part of this source archive.


## v2.6.1 — Quality-of-life and Windows download

- **Verified download page:** the website checks the `desktop-latest` release for a directly downloadable `DevShow-Desktop.exe` and its optional SHA-256 checksum. The button only appears when an uploaded EXE asset is present; no outdated v2.2 executable is labeled current.
- **Safer server configuration:** Settings can test `/api/health` and show the API version before switching servers; failed checks do not change the saved connection.
- **More reliable desktop launcher:** automatically uses a free loopback port if 3217 is occupied, supports `--no-browser` and `--version`, and keeps SQLite in `%APPDATA%\DevShow\data`. The `--self-test` opens the embedded website and validates the database.
- **Windows EXE workflow:** pushes to `main` now build and self-test the EXE on Windows; successful runs upload the raw `.exe` and its checksum to the stable `desktop-latest` prerelease (not a ZIP). A version tag `v2.6.*` also creates a versioned release.

**Build status:** the Windows binary is only verified once the Windows GitHub Actions job succeeds and uploads its release assets. Source tests on Linux do not substitute for executing a Windows EXE.


### v3 notification recovery and live collaboration

- **Durable inbox:** notifications are written to SQLite and fetched again after
  the browser reconnects, the user signs back in, or the server restarts.
- `GET /api/notifications/inbox?after=0&limit=100` requires authentication,
  supports cursor pagination, and returns `items`, `cursor`, `hasMore`, `unreadCount`.
- **Private collaboration invitations** remain visible to the invited account
  while unrelated private project activity remains protected.
- **Live collaborative editor:** the adapted LuauForge editing surface provides
  Luau syntax highlighting and line numbers, with authenticated SSE, member roles,
  chat and revision-checked autosave. Streams automatically reconnect.
- Browser device alerts are opt-in and only run while the tab is open. This is
  not an out-of-browser push notification service. A fully offline backend
  requires an external queue to accept events generated during its outage.
- The originally proposed 41 v3 features are not all production-ready.
  See `docs/RELEASE-v3.md` for implemented scope and remaining integrations.

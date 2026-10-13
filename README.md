# DevShow.io v2.2

**A home for developers to discover projects, build a portfolio, publish progress, and connect with other makers.**

DevShow v2.2 includes a real Node.js API and SQLite-backed account system. GitHub Pages hosts the static website; the Node server hosts the data. **No Cloudflare, paid database service, or frontend build step is required.**

> **Deployment status:** The frontend works as a local demo until you run/deploy the Node.js server and set its public HTTPS URL. GitHub Pages does not execute Node applications or keep a database. Local demo data is separate from accounts on the server; it is not silently uploaded.


## v2.2 — Social community + open-source hub

- **Public Discover feed:** only public projects appear in search, community lists, and public profile projects. The server enforces visibility on every request.
- **Project visibility:** Public, Unlisted (anyone with the link), or Private (owner only). Your private and unlisted work remains visible in your signed-in Creator Studio. Existing projects migrate to public to preserve prior behavior.
- **Profile manager:** select a public project as a pinned showcase; profile skills, location, bio, GitHub link, account export, and password changes remain supported.
- **GitHub collaboration cards:** validated public GitHub repository metadata, stars, forks, language, license, topics, and links to issues, pull requests, and releases. GitHub data is cached, with an optional server-only API token for rate limits.
- **Dev collaboration:** likes, comments, follows, collections, bookmarks, and build logs continue using server-side accounts. Unlisted comments/build logs are visible by direct link, but do not appear in Discover.
- **Deployment:** `Dockerfile`, `.dockerignore`, automated API/desktop tests, volume-backed SQLite example and an explicit no-Cloudflare hosting guide. See **[v2.2 Deployment](docs/DEPLOYMENT-v2.2.md)**.

> **Not yet live worldwide:** The repository contains code, not a running public database. To share across devices, deploy the Node server with public HTTPS and durable storage, then set `window.DEVSHOW_API_URL` in `config.js`. The Windows `.exe` remains a separate local server for personal desktop saving.

## Features

| Feature | Demo (no server) | Server connected |
|---|---|---|
| Discover, search, filter & sort projects | Sample projects | Actual community projects |
| Accounts / login | Local placeholder | Email+password registration and login |
| Profile manager (display name, handle, bio, links, headline) | Browser storage | Persistent user records |
| Publish, edit & delete projects | Local | Persistent with ownership checks |
| Project showcases with cover URLs, tags & categories | Yes | Yes |
| Public repository import (GitHub) | Local copy | Saves project server-side |
| Likes, comments, bookmarks & follows | Local | Synced across users |
| Creator Studio & build logs | Local | Persistent and publicly visible |
| Collections / boards | Local | Private collections per account |
| Notifications | Example messages | Likes, comments, new follows |
| Leaderboard | Samples | Real counts of project engagement |
| JSON account export | Demo JSON backup | Server-side export of owned account data |
| Mobile layout, keyboard navigation, light/dark mode | Yes | Yes |

### Stack

- **Frontend:** plain HTML + modern CSS + ES modules, deployable on GitHub Pages, no bundler.
- **Backend:** Node.js **22.13+**, built-in HTTP server and `node:sqlite`. No `npm install` dependencies are necessary. Using Node 24+ is recommended; on Node 22, `node:sqlite` may show an experimental-feature warning.
- **Storage:** SQLite database on **a persistent volume**, WAL mode and foreign keys enabled.
- **Authentication:** scrypt-hashed passwords, random SHA-256-hashed bearer sessions, expires after 30 days, server-side authorization. Session tokens live in the frontend tab's `sessionStorage`, so signing in again is required in a new tab or browser session.
- **Transport:** HTTPS for a public backend, allowlisted CORS origins.

## Direct Windows `.exe` download

DevShow v2.2 includes a **Windows app** page that detects the actual `DevShow-Desktop.exe` release asset and links directly to it once a Windows CI build succeeds. This is a single-file, self-contained Windows x64 executable built with Node 26 SEA. The user can run it without unpacking a ZIP or installing Node.js; their private local SQLite database persists under `%APPDATA%\DevShow\data\devshow.sqlite`.

The desktop executable starts a loopback-only server at `http://127.0.0.1:3217` and opens the site in the default browser. This provides saving **on that PC**. For publicly shared community data across devices, you still need a separately hosted HTTPS Node.js backend with persistent storage. See [Desktop deployment](docs/DESKTOP.md).

New: server-side JSON account export, password changes that revoke all sessions, developer skills/location, and aggregate stats. See [v2.1 release notes](docs/RELEASES-v2.1.md).

## Run locally

Install a supported Node.js version, then:

```bash
npm start
```

Visit **http://localhost:3000**. This runs **both** the frontend and API. Register an account, publish a project, and visit Creator Studio. The SQLite database will be created in `server/data/devshow.sqlite`.

Verify:

```bash
npm test
curl http://localhost:3000/api/health
```

## Deploy with GitHub Pages + Node.js (no Cloudflare)

**1. Frontend — GitHub Pages**

Publish the repository's root on **Settings → Pages → Deploy from branch → `main` → `/(root)`**. The expected address for this repository is:

`https://sillydev2026.github.io/DevShow.io/`

**2. Backend — a persistent Node hosting provider**

Deploy this same repository to any provider that runs long-lived Node.js processes (for example a VPS, Railway with a persistent volume, Render with a persistent disk, or another Node host):

- **Start command:** `npm start`
- **Runtime:** Node.js 22.13 or newer; recommend Node.js 24+
- **Port:** use the provider-supplied `PORT`; default 3000
- **Public URL:** HTTPS, such as `https://your-devshow-api.example.com`
- **Database:** mount a persistent disk and set `DB_PATH` to an **absolute path inside that disk**, e.g. `/var/lib/devshow/devshow.sqlite`
- **CORS_ORIGINS:** include the exact frontend origin `https://sillydev2026.github.io` (origin only, **no `/DevShow.io/` path**). Add further origins separated by commas. No wildcard allowed.

**Do not deploy SQLite to a temporary or ephemeral filesystem.** An ordinary free-hosting deployment can erase the database on restart unless it offers persistent storage.

**3. Connect the public website**

Change `config.js` in this repository:

```js
window.DEVSHOW_API_URL = 'https://your-devshow-api.example.com';
```

Commit the change. GitHub Pages will then fetch accounts, projects, and activity from your server. While testing, you can also open **Settings → Connect server** in DevShow and enter the URL manually. Localhost is usable for local testing only; it is not reachable from other people's devices.

Public frontend API URL is not a secret. **Never put database credentials, passwords, or authentication secrets in `config.js` or any GitHub Pages file.**

## API summary

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/bootstrap` | Public project feed + current account data |
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Revoke session |
| GET/PATCH | `/api/me` | Read/edit current profile |
| GET | `/api/users`, `/api/users/:handle` | Browse public developer profiles |
| POST | `/api/users/:id/follow` | Follow/unfollow developer |
| GET/POST | `/api/projects` | Browse/create projects |
| GET/PATCH/DELETE | `/api/projects/:id` | Project details, editing, deletion |
| POST | `/api/projects/:id/like` | Toggle like |
| POST | `/api/projects/:id/bookmark` | Toggle bookmark |
| POST | `/api/projects/:id/comments` | Publish comment |
| POST | `/api/projects/:id/logs` | Publish build log |
| POST | `/api/collections` | Create collection |
| POST | `/api/collections/:id/projects` | Toggle collection item |
| DELETE | `/api/collections/:id` | Delete collection |
| POST | `/api/notifications` | Mark notifications read |

Auth-required routes accept `Authorization: Bearer <session-token>`. All input is validated, SQL queries use bound parameters, and project edit/delete operations enforce author ownership. Read `docs/ARCHITECTURE-v2.md` for database and security details.

## Architecture

```
GitHub Pages (static HTML / CSS / JS)
  └── src/cloud.js  ── HTTPS/JSON ──► Node server/index.js
                                      ├── /api/auth, /api/me
                                      ├── /api/projects, /api/users
                                      ├── /api/collections, /api/notifications
                                      └── server/db.js ──► SQLite (persistent disk)
```

## Important limitations and future work

- **No managed production server is deployed as part of the GitHub commit.** You must deploy Node separately, provision persistent disk storage, then configure the API URL.
- Password-reset email, email verification, anti-spam/moderation, image uploads, user blocking, webhooks, and GitHub OAuth are **not implemented**. Public launches should add these before accepting unrestricted registrations.
- The authenticated session is tab-scoped; closing the tab requires signing in again. This avoids long-lived secrets in `localStorage`.
- JSON backup/restore currently applies to the v1 local demo, **not server data**.
- The feed bootstrap endpoint is suitable for a small community; larger communities should add pagination and response caching.
- Profile/project edits persist on the server only when connected and signed in.

## Tests

`npm test` exercises account registration/login, project ownership, persisted feed, follows, bookmarks, comments, collections, build logs, notifications, validation, and CORS checks; it also runs the original frontend smoke test.

## License

No license has been added yet. All rights reserved unless a license is chosen by the owner.

## Development validation

```sh
npm test
npm run test:desktop
```

The CI workflow runs the API/security/visibility tests and desktop adapter self-test. Node.js 24 is recommended; Node.js 22.13+ remains supported. See `docs/RELEASES-v2.2.md`.

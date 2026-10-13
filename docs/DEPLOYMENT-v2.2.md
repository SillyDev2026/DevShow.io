# DevShow v2.2 — public hosting without Cloudflare

GitHub Pages only serves static website files. The public social features require a separate **always-on HTTPS Node.js API** and a durable SQLite database. The local Windows `.exe` is private PC saving, **not a public community server**.

## Architecture

- **Frontend:** `https://sillydev2026.github.io/DevShow.io/` from repository `main` using Pages root.
- **Backend:** one Node.js 24 process, `server/index.js`, accessible over public HTTPS (reverse proxy or managed HTTPS host).
- **Database:** one SQLite file in a **persistent volume**, `DB_PATH=/data/devshow.sqlite`. Back up the database including its WAL via SQLite backup/checkpoint procedure. Do not deploy as stateless multi-replica containers sharing one SQLite file.
- **Authentication:** application password sessions via bearer tokens, HTTPS required. GitHub metadata uses the *public* GitHub API; it is **not GitHub OAuth**.

## Deploy on a container host (Railway, VPS, or another host with persistent disk)

1. Create a new service from this repository, using `Dockerfile`. Don't deploy the website as a Node service on GitHub Pages.
2. Configure an attached persistent volume mounted at **`/data`** and ensure the service runs as the `node` user, able to write this volume. If your host ignores Dockerfile user permissions on the mounted volume, adjust the mount's ownership/permissions.
3. Set these environment variables on the **server**, not in GitHub Pages:

   ```env
   PORT=3000
   DB_PATH=/data/devshow.sqlite
   CORS_ORIGINS=https://sillydev2026.github.io
   NODE_ENV=production
   # Optional secret: GITHUB_TOKEN=...
   ```

4. Enable public HTTPS routing from your provider to container port 3000. Confirm `https://YOUR-API-HOST/api/health` reports `ok:true`. Never expose the SQLite file or private credentials as web-accessible assets.
5. Edit GitHub Pages `config.js`:

   ```js
   window.DEVSHOW_API_URL = 'https://YOUR-API-HOST';
   ```

6. Commit `config.js`. Open DevShow Pages and test registration, publishing, public browsing and private permissions from **two different devices/accounts**. You can test via Settings > Connect server before editing `config.js`.
7. Protect the backend with backups, monitoring, abuse controls, account recovery, and moderation before broadly opening signups.

## Docker local testing

```bash
# Local-only testing, volume persists across container restarts
mkdir -p devshow-local-data
docker build -t devshow:2.2 .
docker run --rm -p 3000:3000 -v "$(pwd)/devshow-local-data:/data" \
  -e CORS_ORIGINS=http://localhost:3000 devshow:2.2
```

On Linux, the host mount must be writable by the image's non-root user; create/adjust permissions for UID 1000 if necessary.

## Public project rules

| Visibility | Discover/feed | Direct ID link | Creator Studio | Shared activity |
|---|---|---|---|---|
| Public | Yes | Everyone | Owner | Yes |
| Unlisted | No | Anyone with link | Owner | Yes, via link |
| Private | No | Only owner | Owner | Disabled |

Unlisted URLs are **not access control for sensitive content**. IDs are random UUIDs, but anyone who receives the link can share it. Private projects cannot be accessed by other accounts through the API. Existing projects migrate to public to preserve the previously public behavior; creators may change them to private in Creator Studio.

## GitHub collaboration

Public repository metadata is fetched server-side from the exact allowed `github.com/owner/repo` path. The API returns description, language, topics, stars, forks, issue and pull request links, releases and license identifier (when GitHub reports one). Responses are cached 5 minutes. Public unauthenticated GitHub API requests have low rate limits; optionally set server-side `GITHUB_TOKEN` to raise them. Never add that token to `config.js` or check it into Git.

The GitHub repository URL alone does not imply an open-source license or grant reuse rights. Authors select licenses on GitHub. Importing a public GitHub repo into DevShow creates a showcase, not a fork or source synchronization.

## API routes added/changed

- `GET /api/projects` lists **public** only, accepts optional `q`, `category`, `sort`.
- `GET /api/bootstrap` returns public feed and owner-only `myProjects` separately, without leaking private/unlisted comments.
- `GET /api/projects/:id` includes details, comments and build logs if visibility permits.
- `POST/PATCH /api/projects` accepts `visibility: public|unlisted|private`.
- `GET /api/github/repository?url=https%3A...` fetches sanitized public metadata.
- `GET /api/projects/:id/github` enforces project visibility before looking up metadata.
- `PATCH /api/me` accepts `pinnedProjectId` for one of the user's public projects; public profiles display it.
- Existing `/api/users`, `/api/users/:handle`, likes, comments, follows, bookmarks, collections, profile security and export continue working.

## Production limitations to resolve before widespread launch

Public account registration currently lacks email verification, password reset, moderation, image hosting, automated DB snapshots and distributed rate limiting. The in-memory rate limiter is per instance. One Node process plus SQLite is appropriate for an early limited beta, not an infinitely scalable platform. Use HTTPS, monitoring, volume backups and moderate registrations before broad promotion.

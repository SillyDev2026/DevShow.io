# DevShow v2.5 deployment

## Static frontend

The repo root is a GitHub Pages site. In Settings → Pages, deploy `main` root. GitHub Pages runs no Node/SQLite code. To connect a production API, update `config.js` with a public HTTPS **origin**, not a URL with `/api` or secrets.

## API

- Deploy the repo as a Node service (`npm start`); no install is required to run the API.
- On a Docker host, build the included `Dockerfile`. Map its port `3000` to your service; use an HTTPS domain or provider URL.
- **Mount a persistent writable volume at `/data`**. Set `DB_PATH=/data/devshow.sqlite`. A temporary filesystem is not acceptable.
- Set `CORS_ORIGINS=https://sillydev2026.github.io` (the exact origin without `/DevShow.io`). Add other actual frontend origins as a comma-separated list.
- Optionally set `GITHUB_TOKEN` on the server for the public GitHub API rate limit. Never put this token in frontend files.
- Check `GET /api/health` and `GET /api/stats`. Use a dedicated health check, HTTPS and backups.
- Build an account recovery and moderation process before large-scale public registration.

## Data migration from v2.1/v2.2

Stop the old server. **Make a verified backup of its `.sqlite`, `-wal` and `-shm` files (or a consistent SQLite backup) before the first v2.5 boot.** Reuse the old DB at the new `DB_PATH`. The code creates missing columns without dropping existing records. Existing public projects remain public. Review project privacy before public launch.

Do not copy databases through a running transaction without a consistent backup. The database is not included in the source repository or GitHub Pages deployment.

## Windows direct download

Push a version tag matching `v2.5.*` and run/check the Windows workflow. The workflow tests a generated SEA and publishes `DevShow-Desktop.exe` to GitHub Releases when it succeeds. Users visit `releases/latest`; no ZIP is needed for the finished executable. The app uses a **local** database at `%APPDATA%\DevShow\data\devshow.sqlite` and is not a production community host.

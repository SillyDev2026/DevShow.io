# DevShow v2.6 — Deployment Guide

## Hosting

GitHub Pages hosts the website. Host Node.js 22.13+ separately (VPS or container platform) over HTTPS with durable storage. `Dockerfile` works with a volume mounted at `/data`.

Set server secrets in the hosting provider's environment settings, **never** in `config.js`, GitHub Pages or this repository.

```env
PORT=3000
DB_PATH=/data/devshow.sqlite
CORS_ORIGINS=https://sillydev2026.github.io
PUBLIC_SITE_URL=https://sillydev2026.github.io/DevShow.io/
GITHUB_CLIENT_ID=your_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_oauth_app_secret
GITHUB_CALLBACK_URL=https://api.yourdomain.com/api/auth/github/callback
GITHUB_TOKEN=optional_backend_only_GitHub_API_token
NODE_ENV=production
```

Enable a persistent volume mounted at `/data`. Uploaded images are saved in `/data/media`; back up that folder **with** `/data/devshow.sqlite` to preserve media references. Use health checks against `GET /api/health`.

Create a GitHub **OAuth App** with homepage `https://sillydev2026.github.io/DevShow.io/` and authorization callback URL exactly matching `GITHUB_CALLBACK_URL`. GitHub OAuth cannot sign in until a public backend and credentials exist. The OAuth flow requests `read:user user:email`. Existing DevShow email accounts must sign in with their email/password and link GitHub to avoid unsafe account takeover.

After deploying the Node service, update the Pages `config.js`:

```js
window.DEVSHOW_API_URL = 'https://api.yourdomain.com';
```

No Cloudflare is required. Do not point `DEVSHOW_API_URL` at a local-only `127.0.0.1` service for production visitors. SQLite storage and the built-in SSE implementation are single-host/single-process. If scaling to multiple nodes, use a shared database + pub/sub and durable object storage.

## Security baseline

- Store secrets only on the Node service.
- Enable HTTPS/HSTS at reverse proxy, set request limits and backup rotation, restrict origin via `CORS_ORIGINS`, rotate credentials on incidents.
- Add email recovery and verification, anti-spam, moderation, content reporting, retention/deletion policies before opening unrestricted public registration.
- PNG/JPEG/WebP uploads are type-sniffed and size-limited, but production storage should include additional image transcoding and malware checks.
- SSE uses bearer-token authentication and holds an open HTTP request; configure proxy buffering off and appropriate connection limits.
- Private project media can only be retrieved with an authorized bearer token. Standard `<img>` tags cannot include bearer headers, so consider authenticated blob previews for private project media in a future update.

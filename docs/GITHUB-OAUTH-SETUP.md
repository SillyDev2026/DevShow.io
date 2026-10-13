# DevShow.io — GitHub OAuth setup

The GitHub Pages site is the **frontend**. GitHub OAuth authorization, code exchange,
and account-session creation run in the separately hosted Node.js backend.
The Windows EXE bundles a **local** Node.js service; it is not a public OAuth server.

## Security first

If an OAuth client secret has ever been posted in a chat, ticket, log, or other
uncontrolled location, **revoke that secret** in GitHub Developer Settings and
generate a new one. Never paste the replacement into a conversation.
Never put the client secret into `config.js`, source control, browser assets,
the executable, a workflow file, or a release ZIP.

## 1. Deploy the backend

Deploy the repository's `Dockerfile` on a platform supporting persistent storage
and HTTPS (such as Railway with a volume, or a VPS). Use persistent `/data`
storage for the SQLite database and uploaded media.

In the platform's **private environment variable settings**, configure:

```env
NODE_ENV=production
PORT=3000
DB_PATH=/data/devshow.sqlite
CORS_ORIGINS=https://sillydev2026.github.io
PUBLIC_SITE_URL=https://sillydev2026.github.io/DevShow.io/
GITHUB_CLIENT_ID=<client ID from GitHub>
GITHUB_CLIENT_SECRET=<NEW secret kept only on the backend>
GITHUB_CALLBACK_URL=https://YOUR-ACTUAL-API-HOST/api/auth/github/callback
```

Replace `YOUR-ACTUAL-API-HOST` with the host assigned by your backend provider.
Use the backend's HTTPS URL, **not** the GitHub Pages URL, for the callback.

## 2. Register GitHub OAuth application

Open https://github.com/settings/developers and configure the OAuth App:

- Homepage URL: `https://sillydev2026.github.io/DevShow.io/`
- Authorization callback URL: `https://YOUR-ACTUAL-API-HOST/api/auth/github/callback`
- Wildcard redirect matching: disabled
- Device flow: optional, not needed for normal browser sign-in

The callback must match `GITHUB_CALLBACK_URL` exactly. The backend already
implements the authorization-code flow, server-side secret exchange, state
validation, one-use sign-in ticket, and account linking.

**Access token expiry:** The current OAuth callback doesn't store a GitHub
refresh token. Leave token expiration disabled until a refresh-token handling
flow is implemented and tested.

## 3. Connect the website

Edit the **public** `config.js` to point to the deployed backend:

```js
window.DEVSHOW_API_URL = 'https://YOUR-ACTUAL-API-HOST';
```

This public URL is safe to expose. Do not include credentials in this file.
Publish the GitHub Pages deployment and check the backend's `/api/health` route.
Then click **Sign in with GitHub** and verify return to DevShow.io.

## 4. Windows EXE

Download the built Windows executable from GitHub Releases. It works with a
local API and local database; it **does not expose a hosted API to the internet**.
Local OAuth configured with a localhost-only callback is useful only for the
person operating that computer and is not a substitute for hosted sign-in.
For cross-device identity, public collaboration and sync, run the hosted backend.

## Troubleshooting

- **GitHub OAuth is not configured**: check all four `GITHUB_*` and
  `PUBLIC_SITE_URL` variables on the running backend.
- **404 on callback**: the OAuth App points to GitHub Pages or the wrong host.
  Set it to the backend's `/api/auth/github/callback` route.
- **Backend unreachable**: verify deployed HTTPS API URL in `config.js` and
  check `/api/health`.
- **Email already belongs to a DevShow account**: log in with the existing
  DevShow account and link GitHub in Settings; don't create a duplicate.
- **Sign-in ticket expired**: retry the login process promptly.

See also [deployment guide](DEPLOYMENT-v2.6.md).

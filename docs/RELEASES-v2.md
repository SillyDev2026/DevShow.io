# DevShow v2.0 release

- New persistent SQLite-backed Node.js API (`server/index.js`, `server/db.js`).
- Real account registration, login, logout, and public profile manager.
- Project CRUD, GitHub import, likes, comments, bookmarks, follows, build logs and collections saved server-side.
- Shared feed, public developer profiles, leaderboards and activity notifications.
- GitHub Pages still serves the static website. API base configured via `config.js` or Settings.
- Existing v1.5 demo remains available when no backend is configured; no unexpected upload of local data.
- Added API tests and cross-device browser workflow coverage.
- Added Node host environment template and deployment architecture docs.

## Known limits

No hosted backend provisioned yet. Account email verification/reset, GitHub OAuth, file/image uploads, content moderation and realtime WebSocket push are future features.

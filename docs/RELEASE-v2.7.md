# DevShow 2.7.0 — collaboration and quality-of-life release

The new functionality is **additive** to the existing Node.js API and SQLite data model. Previous projects and user accounts are not deleted or recreated.

## Shipped interfaces and API workflows

1. **Live project activity:** `GET /api/v2/activity` displays newly published public projects and release/build logs. Existing single-process SSE sends update events. No multi-user simultaneous editor is claimed.
2. **Interactive demos:** `GET/PUT /api/v2/projects/:id/demo`; owners can configure a public HTTPS URL. The UI embeds external sites with `sandbox="allow-scripts"`, *without* `allow-same-origin`. Some third-party sites disable embedding and must be opened externally.
3. **Developer teams:** create a team, invite DevShow usernames, accept/decline invitations, remove members, and associate owner-controlled projects with the team. Roles (`owner`, `maintainer`, `contributor`) govern team operations. **Team membership does not yet authorize editing each other's project records.**
4. **Code explorer:** navigate public GitHub repository directory paths using `GET /api/v2/projects/:id/code-tree`; preview files through the existing capped file-preview endpoint. GitHub API rate limits apply. Private DevShow project permissions are respected.
5. **Custom dashboard:** users choose and order widgets, persisted in `dashboard_preferences`. `GET/PUT /api/v2/dashboard`.
6. **Suggestions & bug reports:** current per-project feedback board now has one vote per signed-in user; `GET /api/v2/projects/:id/suggestions` and `POST /api/v2/projects/:id/suggestions/:feedbackId/vote`.
7. **Reputation and levels:** server-computed points for *public* projects, accepted public suggestions, likes on public projects, and active team memberships. No points from repetitive posts or messages; `GET /api/v2/reputation`.
8. **Desktop/cloud draft sync:** `GET/PUT /api/v2/sync` manages account-scoped drafts, notes and preferences with optimistic revision checks. The browser UI supports manually importing the JSON into a signed-in session and downloading a backup. This is **manual**, not automatic full SQLite replication or cross-device project merge. Cloud sync requires a reachable shared API and login; desktop mode uses local storage by default.
9. **Notification preferences:** `GET/PUT /api/v2/notifications/preferences` lets users suppress future message, follow, project and feedback alerts. Existing alerts remain.
10. **Project launch calendar:** owners schedule/delete future launch events; public listings only include launches for public projects. `GET /api/v2/launches`.

## Integrity and security

- Additive migrations in `server/v27-db.js`; existing schema rows preserved.
- API ownership and visibility checked before project-linked updates.
- Team invitations cannot be accepted by a different account; protected project lists never leak private items.
- Sync revision mismatch returns HTTP 409 instead of overwriting newer state.
- GitHub directory requests are restricted to `api.github.com`, validated paths, 7-second timeout and 300 KB responses.
- External iframe demos are sandboxed, no same-origin privilege.
- Cross-origin `PUT` preflights are included, and desktop loopback ports allow matching same-origin requests after fallback.

## Production deployment

Static frontend stays on GitHub Pages; the Node.js API is a separately hosted service. Use HTTPS, `DB_PATH` on a persistent volume, `CORS_ORIGINS` for your GitHub Pages origin, and the existing OAuth variables from `docs/DEPLOYMENT-v2.6.md`. For desktop, the Windows workflow builds on `main` and on `v2.7.*` tags, runs server tests and the packaged `.exe` self-test, then publishes a release asset **only after validation**.

**Not included:** automatic bi-directional whole-database replication; multi-user simultaneous source editing; code writing directly into GitHub; email recovery; global cross-process websocket collaboration; public API hosting. These require additional backend infrastructure and work.

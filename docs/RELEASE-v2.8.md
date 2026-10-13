# DevShow v2.8 — Creator Experience and Trust

## Scope and truth in labeling

The earlier brainstorming message did not retain its numbered list. This release therefore defines a concrete 30-item implementation checklist. Items below are functional interface/API capabilities; some expand an existing feature rather than introducing a brand-new subsystem. No hosted API or Windows binary is created by this source commit alone.

### 30 implemented improvements

| # | Feature | API / screen |
|---|---|---|
| 1 | Full-text public-project search | `GET /api/v3/discover?q=` |
| 2 | Category-specific discovery | `category` parameter |
| 3 | Exact tag matching for discover | `tag` parameter |
| 4 | Newest-first ordering | `sort=newest` |
| 5 | Most-liked ordering | `sort=liked` |
| 6 | Most-discussed ordering | `sort=discussed` |
| 7 | Popularity ordering | `sort=popular` |
| 8 | Server pagination and total count | `limit`, `offset`, `hasMore` |
| 9 | Trending public tag counts | `GET /api/v3/tags` |
| 10 | Followed-creators-only feed | `GET /api/v3/feed/following` |
| 11 | Save named search filters | `POST /api/v3/saved-searches` |
| 12 | Reopen saved search filters | `GET /api/v3/saved-searches` |
| 13 | Delete a saved search | `DELETE /api/v3/saved-searches/:id` |
| 14 | Set project development stage | `PUT /api/v3/projects/:id/workspace` |
| 15 | Mark a project as recruiting contributors | Workspace `recruiting` |
| 16 | Showcase a technology stack | Workspace `stack` |
| 17 | Documentation URL per project | Workspace `docsUrl` |
| 18 | Support/issue-tracker URL per project | Workspace `supportUrl` |
| 19 | Owner-only project task checklist | `GET/POST .../tasks` |
| 20 | Complete and reopen tasks | `PATCH .../tasks/:taskId` |
| 21 | Delete outdated tasks | `DELETE .../tasks/:taskId` |
| 22 | Create release milestones | `GET/POST .../milestones` |
| 23 | Optional milestone due dates | `dueDate` validated as ISO date |
| 24 | Advance milestone status / delete milestone | `PATCH/DELETE .../milestones/:id` |
| 25 | Creator-wide dashboard metrics | `GET /api/v3/studio/overview` |
| 26 | Project workspace JSON export | `GET /api/v3/studio/export` |
| 27 | Project abuse reports | `POST /api/v3/reports` |
| 28 | Developer profile abuse reports | `POST /api/v3/reports` |
| 29 | Block/unblock and manage developer visibility | `POST /api/v3/users/:id/block`, `GET /api/v3/me/blocks` |
| 30 | Mark notifications individually read | `POST /api/v3/notifications/:id/read` |

### Supporting release improvements

- New **Workspace 2.8** responsive screen is accessible from desktop and the mobile More menu; project detail and public profiles expose the new controls.
- The existing authenticated API, SQLite, GitHub OAuth hooks, social posts, teams, messaging, release links, feedback votes, local desktop server and manual draft synchronization remain intact.
- `server/v28-db.js` only adds tables with foreign keys and leaves pre-existing rows untouched; no destructive DB rebuild or silent cloud migration occurs.
- Privacy rules keep hidden projects out of Discover and tags, deny task access to non-owners, and keep Studio exports private. Blocked accounts are excluded from **v3 Discover and Following feeds**, not the legacy feed or public direct links. Blocking is a feed preference, **not** a communication-level ban.
- Reports are stored in `content_reports`, but the project **does not yet provide moderator tooling or human review**; don't claim a report is reviewed unless operators arrange moderation.
- Desktop status is explicit: the EXE's private SQLite data is not magically synchronized with a hosted community; manual revision-safe draft sync remains available separately.
- Windows single-executable workflow now includes `src/v28.js`, embeds the responsive stylesheet, runs API and desktop source tests and on successful builds publishes an unsigned `.exe` with SHA-256. A Windows GitHub runner is required to verify/generate the actual new executable.

## Testing and release

Run `npm test` for regression, privacy, and v2.8 tests. Windows builders additionally run `npm run test:desktop`, `node --build-sea dist/sea-config.json`, and execute `DevShow-Desktop.exe --self-test` before replacing the stable download.

The browser automation environment used for this development blocked navigation to `localhost`, so viewport screenshots and interaction smoke checks must be performed in a Windows GitHub runner or local browser before marking visual QA complete.

## Production rollout

1. **Back up the existing SQLite database** and run the new Node.js server against a copy first.
2. Deploy the API on HTTPS with persistent disk (`DB_PATH`) and exact `CORS_ORIGINS`.
3. Update GitHub Pages on the same commit as the backend and set the public API URL in `config.js`.
4. Complete account recovery, moderation operations, abuse controls, backups, and monitoring before opening registrations broadly.
5. Verify Windows Actions succeeded and that the `desktop-latest` GitHub Release actually points to v2.8 before advertising the downloaded EXE as current.

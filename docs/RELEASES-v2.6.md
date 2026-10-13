# DevShow v2.6 — Community, Identity and Creator Studio

v2.6 builds on v2.5.1 without resetting accounts, sessions, projects, followers, bookmarks, comments or collections. Server boot performs additive SQLite schema migrations.

## Built features

- Profile editor: uploaded avatar/banner images, status, profile theme, portfolio presentation, computed achievement badges, featured public project.
- Public social posts, topic groups, membership, group discussion; private direct messages; notifications live stream over authenticated SSE.
- GitHub OAuth App sign-in and account linking using short-lived, one-time callback tickets. Server-side code exchange; no access token is exposed to the Pages frontend. Requires configuration.
- Public repository metadata sync, release assets, and read-only 64 KB text file preview, with fixed GitHub API host and input checks.
- Creator Studio project views per day, owner-only analytics, roadmaps/milestones and feedback moderation.
- Server-stored PNG/JPEG/WebP media up to 1 MB; media stored alongside the persistent SQLite DB; private project uploads require project-authorized API request.
- Read-only public API at `GET /api/v1/projects`; authenticated live stream at `GET /api/events`.
- Tests validating permissions across profiles, groups, conversations, images, private projects, and new migration tables.

## Not in v2.6

- Rich-text editing, video uploads, general file attachments, in-browser code commits, branching/merging, websocket collaborative text editing, multi-node cross-instance events, Web Push, email-based verification/reset, moderation at production scale.
- No bundled Windows EXE is produced by this source release without running the Windows build workflow.

## Security and deployment notes

Only publish to a public host after setting up HTTPS, reverse proxy, persistent media+database storage, exact CORS origins, private OAuth secrets, backups, spam prevention and moderation policy. This release is a feature foundation, **not a security audit**.

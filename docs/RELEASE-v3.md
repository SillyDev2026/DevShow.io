# DevShow v3.0 — live editor foundation and 41-feature roadmap

**Release status:** Source implementation and integration tests. An actual Windows EXE requires a successful GitHub Actions Windows build; a live multi-user community requires a hosted HTTPS Node.js API and durable SQLite storage.

## Implemented in this release

1. **Live project collaboration:** Authenticated Server-Sent Events (SSE) broadcast document revisions, chat, and collaborator presence. Connected browsers reload *only saved* changes; typing is autosaved after a debounce.
2. **Developer invitations:** Only project owners may invite a registered DevShow user by handle. Invitations require explicit acceptance and can be declined or revoked.
3. **Role-based permissions:** Project owners and editors can write documents; viewers can read and participate in project chat without modifying source. Private project documents cannot be discovered without membership.
4. **LuauForge editor reuse:** The `src/editor/playground-luau.js` editor is adapted from the user's `Luau-Developer-Playground` / LuauForge repository (highlighting, indentation, line gutter, bracket pairing, Android newline handling). Changes to LuauForge upstream are not automatically imported into DevShow.
5. **Multi-file workspace:** Create and delete Luau, Lua, JavaScript, TypeScript, Python, Rust, JSON, and text files with validated, relative paths. A workspace supports at most 80 documents; an individual document is limited to 90 KiB.
6. **Revision-safe saves and history:** Every write requires the most recent `baseRevision`; a mismatch responds `409` with the latest content. The app preserves unsaved local text on conflicts; it does not silently merge different edits. The last 30 previous revisions are retained.
7. **Live team chat and presence:** Authenticated members share text chat and see approximate active-client counts.
8. **Fluid editor UI:** Responsive editor, file navigator, member invites, role labels, chat, and status indicators, including a mobile layout.
9. **Windows desktop asset manifest:** The new page, styles and editor module are included in the Node single-executable application's bundled assets. The workflow selects `v3.0.*` tags; the EXE must still pass Windows CI before it can be offered as a verified download.
10. **Regression and security coverage:** Historical v2 APIs and SQLite tables are preserved, and v3 tests exercise invitations, role restrictions, revisions, source path validation, private project access, chat, revocation and SSE.

## Status of the requested 41-feature vision

DevShow v3.0's live-editor foundation is implemented. The broader feature list—including full CRDT/OT simultaneous editing, synchronized voice chat, an AI assistant, AI code review, intelligent completions, automatic two-way offline database sync, conflict-free merges, real-time multi-process collaboration, a complete plugin marketplace and a fully managed public SaaS deployment—**is not implemented or production-ready** in this release. Several existing v2.x features (GitHub linking, team management, project analytics, feedback, badges/reputation and downloadable releases) are retained, but are not new implementations here. Implement these independently with security and integration tests rather than claiming 41 complete features without verification.

## Live editing model

`DevShow client` → `POST invite` → `Developer accepts` → `GET source` → `PUT {content,baseRevision}` → `SQLite transaction increments revision` → `authenticated SSE notification` → `other clients fetch latest revision`.

Changes become visible to collaborators after the 750 ms save debounce and round-trip API request. This is **near-real-time saved-document synchronization**, not character-level multiplayer cursors or conflict-free concurrent typing. When another editor saves while you have unsaved changes, DevShow warns you and leaves your text intact. Copy the local text, inspect the latest saved revision and manually merge.

The transport is single-process SSE, and requires a hosted HTTPS backend for cross-device users. Behind multiple Node processes, use a shared pub/sub broker (e.g. Redis) and sticky-session strategy; the current in-memory SSE subscriber map does not fan out across instances. The app's optional Windows desktop runs a private local Node server by default and does not create a publicly reachable collaboration server.

## Privacy and operator notes

- Keep a persistent volume for SQLite; never place `.sqlite` files or credentials on GitHub Pages.
- Read-only members can view entire shared files and chat; do not invite users to code you want to keep secret.
- Use HTTPS for public traffic and configure `CORS_ORIGINS`. The app accepts bearer credentials through HTTP headers, **not** URL query tokens for SSE.
- Access revocation terminates existing SSE streams before emitting additional events; failed authorization returns 404 to avoid leaking private workspace existence.
- Do not expose unrestricted registration until email recovery, moderation, stronger rate limiting and backups are deployed.

## Commands

```bash
npm test
npm run build:desktop
npm run test:desktop
```

Building an actual Windows EXE requires a compatible **Windows** GitHub Actions runner with Node.js 26 and `node --build-sea dist/sea-config.json`. The build workflow validates the generated EXE before uploading release assets.

## LuauForge source

Original editor: https://github.com/SillyDev2026/Luau-Developer-Playground

DevShow's adapted editor intentionally does not bundle the Luau compiler, Roblox API dataset or Luau WASM runtime. These are distinct deliverables and would substantially increase the Windows binary and web assets.


## Durable notification catch-up (added during v3 integration)

A notification is committed to SQLite **before** the server publishes an SSE hint.
When a signed-in browser connects, reconnects, becomes visible, or resumes network
connectivity, it requests `GET /api/notifications/inbox?after=<cursor>&limit=100`.
The API paginates by SQLite rowid, avoiding events with identical timestamps and
returning `items`, `cursor`, `hasMore`, and `unreadCount`.
Cursors are scoped to the signed-in account and API origin in session storage;
missing local cursors safely start from zero. The inbox stores read/unread state
on the server, and missed events reappear even if the browser or API restarts.

The recipient of a pending private-project collaboration invitation may see that
specific notification. Other private-project notifications continue to respect
server-side visibility. Guests cannot fetch anybody's inbox, and marking all as
read still requires the authenticated session.

Optional browser device notifications require user-initiated permission and only
work while a browser tab is running in the background. Fully closed-browser
push requires a service worker and push infrastructure, which is **not** implemented.
A backend outage cannot receive and durably queue brand-new upstream events; that
would require a separate durable external event queue or a retrying webhook source.

Live editor streams now reconnect with bounded backoff and reload the newest
revision after a gap only when there are no unsaved local edits. Concurrent edits
are revision-checked, **not CRDT merged**; clients retain unsaved text on conflict.

## v3 platform scope

The previous forty-feature list is a release roadmap, not a claim that all forty
features have working endpoints. The implemented shared-editor milestone covers
LuauForge-derived editing, project-member invitations, roles, live presence,
revision-checked autosave, chat, version history, and reconnect recovery. Existing
v2.8 project/community tools remain available. Advanced AI integrations, voice
channels, a third-party extension marketplace, fully automatic desktop database
replication, real-time CRDT merging, and unrestricted public launch hardening
remain unimplemented and should not be marked shipped.

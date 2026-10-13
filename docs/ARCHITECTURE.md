# DevShow architecture — production design

## 1. Scope and system boundaries

```text
Browser (desktop / mobile)
  └── GitHub Pages (static HTML, CSS, JS)
      ├── Local demo data (current v1.0 preview)
      ├── Public GitHub REST metadata import (current v1.0 preview)
      └── HTTPS JSON API (future integration)
            ├── Node.js + Fastify or Express
            ├── PostgreSQL (primary persistent data)
            ├── Redis (optional cache, rate limits, background jobs)
            ├── S3-compatible object storage (project screenshots)
            └── GitHub OAuth authorization-code exchange (server-only)
```

GitHub Pages handles only static assets. GitHub sign-in **cannot** be securely implemented as browser-only OAuth with a client secret. Deploy the API on a separate backend host or VPS with HTTPS, and store secrets as runtime environment variables. Cloudflare is not used.

## 2. Core frontend modules (current)

| File | Responsibility |
|---|---|
| `index.html` | SEO/OG head, layout root, module script |
| `styles.css` | CSS variables, tokens, cards, components, breakpoints, dark/light modes |
| `src/data.js` | Categories, sample accounts, seed projects; swap for API responses later |
| `src/app.js` | Hash routing, views, local CRUD, UI events, HTML escaping, GitHub public import |

The existing app is framework-free to make deploying and iterating simple. In a larger release, split `app.js` into `features/{discover,projects,profiles,notifications}`, `components`, `stores`, and `services/api.js`, and use a typechecked frontend framework if useful. Preserve hash routing or add a Pages-compatible SPA fallback.

## 3. Planned backend interface

All JSON responses must have a consistent `{ data, error, meta }` envelope. Apply server-side pagination, validation, authorization, and throttling. Suggested REST resources:

| Method / route | Access | Purpose |
|---|---|---|
| `GET /v1/projects?category=&sort=&q=&cursor=` | Public | Feed/search |
| `GET /v1/projects/:slug` | Public | Project detail |
| `POST /v1/projects` | Signed in | Create project |
| `PATCH /v1/projects/:id` | Owner/moderator | Update project |
| `DELETE /v1/projects/:id` | Owner/moderator | Delete project |
| `PUT /v1/projects/:id/like` | Signed in | Idempotent like |
| `DELETE /v1/projects/:id/like` | Signed in | Unlike |
| `PUT /v1/bookmarks/:projectId` | Signed in | Add bookmark |
| `DELETE /v1/bookmarks/:projectId` | Signed in | Remove bookmark |
| `GET /v1/projects/:id/comments?cursor=` | Public | Paginated comments |
| `POST /v1/projects/:id/comments` | Signed in | Post a comment |
| `GET /v1/users/:handle` | Public | User profile |
| `PATCH /v1/me` | Signed in | Edit own profile |
| `PUT /v1/follows/:userId` | Signed in | Follow creator |
| `DELETE /v1/follows/:userId` | Signed in | Unfollow creator |
| `GET /v1/leaderboard?period=weekly` | Public | Moderated rankings |
| `GET /v1/notifications` | Signed in | Personal notifications |
| `GET /auth/github/start` | Public | Begin authorization-code sign-in |
| `GET /auth/github/callback` | Public | Validate state, exchange code, create session |
| `POST /auth/logout` | Signed in | Revoke session |
| `POST /v1/uploads/presign` | Signed in | Generate limited signed upload URL |
| `POST /v1/reports` | Signed in | Report abuse |

## 4. Data model (PostgreSQL)

- **users:** UUID id, immutable github_user_id (unique), handle (unique, case-folded), display_name, bio, avatar_url, created_at, updated_at, status.
- **sessions:** hashed session identifier, user_id, expires_at, revoked_at, last_seen_at. Never store raw session IDs.
- **projects:** UUID id, owner_id, slug (unique), title, tagline, description, category_id, repo_url, website_url, visibility, status, created_at, updated_at, published_at.
- **project_tags:** `(project_id, tag_id)` unique composite key; **tags:** normalized slug/name.
- **project_media:** project_id, object_key, sort_order, media_type, alt_text, moderation_status.
- **likes:** `(user_id, project_id)` composite primary key.
- **bookmarks:** `(user_id, project_id)` composite primary key.
- **follows:** `(follower_id, following_id)` composite primary key and check different IDs.
- **comments:** UUID id, project_id, author_id, body, parent_id nullable, status, created_at, updated_at.
- **notifications:** user_id, actor_id, event_type, target_id, read_at, created_at.
- **reports:** reporter_id, target_kind, target_id, reason, status, reviewer_id.
- **moderation_audit:** actor_id, action, target, context JSONB, created_at.

Use database constraints for uniqueness, FKs and referential integrity. Create indexes on published project timestamp, category, owner, trending signals and search `tsvector`. Likes and follows must be unique; derive counts from source records or denormalize with transactional updates.

## 5. GitHub OAuth flow

1. The browser navigates to `https://api.example.com/auth/github/start`.
2. API creates a high-entropy state nonce (and PKCE when supported), stores it server-side with short TTL, redirects to GitHub.
3. GitHub redirects back **to the API**, not to GitHub Pages. API validates state, exchanges the code via server-side secret, and retrieves the immutable GitHub numeric user ID.
4. API sets a `Secure`, `HttpOnly`, `SameSite` session cookie; rotate session on login and expiration.
5. Frontend calls `/v1/me` with `credentials: 'include'`; API configures CORS for the exact Pages/custom domain, not `*`.
6. Optional GitHub repo import should prefer public read-only GitHub endpoints or explicitly authorized minimal permissions; avoid collecting unnecessary scopes.

Never ship a GitHub client secret, database connection string, storage key, or access token in static Pages files. Use a CSRF strategy for authenticated state-changing requests; reject unsafe methods without a valid CSRF token or strict origin check. Hash OAuth secrets/tokens at rest where possible or use strong encryption for any long-lived tokens that are actually needed.

## 6. Security, abuse prevention, moderation

- Server input validation (Zod/JSON schema), length limits, strict URL protocol allowlist.
- Output encoding and sanitization (only allow rich HTML if sanitized with a proven library).
- Post/comment throttling per user and per IP, account-age limits, duplicate detection.
- Image size and MIME constraints, scan uploads, serve from an untrusted media domain.
- AuthZ check on every project edit/delete, use non-enumerable session tokens.
- Anti-vote-brigading: distinguish unique users, velocity and suspicious patterns. Avoid making XP purchasable through spam.
- User reporting, block/mute, reviewer queue, appeal paths, audit logs, and basic published community rules.
- `Content-Security-Policy`, strict transport security, secret rotation, request logging without credential leakage.
- Backups and restore drills for PostgreSQL; migrations run in CI/CD.
- GDPR/CCPA-style export and deletion considerations before opening signups.

## 7. Suggested deployment stages

1. **Static preview** (this package): GitHub Pages with demo community and browser persistence.
2. **API alpha:** deploy Node backend + PostgreSQL to HTTPS backend host; implement `/health`, auth, user profiles.
3. **Shared beta:** persisted project publication, feeds, likes, bookmarks, follows, comments, moderation and uploads; build REST client with graceful loading/error/empty states.
4. **Community launch:** realtime/polled notifications, featured projects, anti-abuse ranked feeds, observability, retention and load tests.

Mobile breakpoints are at 1260px, 1060px, 740px, and 490px. Mobile uses a fixed bottom navigation with safe-area support; interfaces remain keyboard accessible and respect reduced motion.

## 8. Production acceptance checklist

- [ ] Real GitHub authentication, sign out, expired session paths
- [ ] Persistent DB across sessions, devices, browser storage cleared
- [ ] Access-controlled project creation and delete/update
- [ ] Pagination and cursor semantics; no duplicate feed results
- [ ] SEO metadata/social previews per project (requires rendering strategy beyond current hash-only shell)
- [ ] Image uploads with secure validation and moderation
- [ ] Server-side permission validation, CSRF, rate limiting, audit log
- [ ] Accessibility review (WCAG), keyboard/focus trap, contrast
- [ ] Monitoring, error tracking, backups, deployment rollbacks
- [ ] E2E tests for cross-user engagement and moderation flows

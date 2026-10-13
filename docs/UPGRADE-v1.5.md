# DevShow v1.5 — Creative Studio update

This upgrade **replaces the original v1.0 static frontend**, retains its localStorage key for backwards-compatible browser data, and still deploys as a plain GitHub Pages site. It does not require Cloudflare or a build pipeline.

## New in v1.5

- **New responsive discovery experience:** upgraded hero with code-editor visual, launch announcement, project spotlight, refreshed browsing cards, mobile spacing and accessible focus styles.
- **Creator Studio:** local-only counts, quick project management, edit actions, per-project build updates and public GitHub repository importer.
- **Collections:** create named boards, add/remove any project from a board, inspect contents, and delete boards without deleting source projects.
- **Editable projects:** change metadata, category, description, links, tags, and external cover image URL after publishing.
- **Build logs:** versioned progress notes per owned project, shown inside its detail view.
- **Backup/restore:** download a versioned JSON backup from Settings and restore on another device; restore is schema-validated, limits sizes and asks for confirmation before replacing local data.
- **Mobile navigation:** bottom navigation plus a complete `More` menu for settings, collections and the remainder of the site.
- **Keyboard shortcuts:** Ctrl/Cmd+K for search, N to share, G then E to explore, G then S for Studio, Escape to close a dialog.
- **Accessibility improvements:** modal keyboard focus containment and restored focus after closing, descriptive controls and reduced-motion CSS support.

## Important constraints

**This is a local-first prototype, not a networked multi-user community.** Real sign-in, cross-device data, public publication, moderation, notifications, global leaderboards and media uploads require a separate backend.

The built-in creators/projects and their engagement figures are **fictional demonstration data**. User contributions, likes, bookmarks, logs and comments remain in that specific browser's storage. External cover URLs are hotlinked and will only work while the source URL remains accessible. A local-only project does not have a publicly shareable URL.

## Important deployment details

- Upload the **contents of `DevShow.io/`** to the root of `SillyDev2026/DevShow.io`, preserving `src/`, `assets/`, and `.nojekyll`.
- GitHub repository **Settings → Pages → Deploy from a branch → main → /(root)**.
- Project page URL typically `https://sillydev2026.github.io/DevShow.io/` after Pages is enabled.
- Alternatively upload **only the `DevShow-single-file.html`** after renaming it to `index.html`. It includes the same v1.5 CSS, sample data and JS in one file. A modular deployment is easier to maintain.
- The public GitHub importer calls `api.github.com` without a personal token. Only public repositories work and unauthenticated rate limits apply.
- **Never** commit OAuth client secrets or private keys to this repository or any GitHub Pages frontend.

## Suggested v1.6 / v2 production milestone

1. Node.js TypeScript/Fastify REST API, validated input, auth sessions and PostgreSQL schema.
2. Real GitHub OAuth with PKCE via the server; secret values never shipped to Pages.
3. Projects, version histories, membership and moderation queues stored centrally.
4. Per-user rate limiting, content validation, CSRF protections, sanitized output and audit logs.
5. Replace demo feed with real records, pagination and community sort backed by server-generated metrics.
6. Deploy API to a VPS or suitable Node host, point frontend at the API and add a custom domain if actually owned.

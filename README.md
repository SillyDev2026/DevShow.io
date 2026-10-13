# DevShow.io

**Discover what developers are building.** A polished, responsive showcase network for web, mobile, AI, Roblox, games, open-source, and developer tools.

![Version](https://img.shields.io/badge/version-1.5.0-b4ffa6?style=flat-square&labelColor=19232c) ![Stack](https://img.shields.io/badge/stack-HTML%20%2B%20CSS%20%2B%20JS-9ba7e8?style=flat-square&labelColor=19232c)

## Current release: v1.5 Creative Studio frontend preview

The **frontend is functional and intentionally local-first**. Pages, project cards, search, category filtering, sorting, local publication, profile editing, reactions, bookmarks, following, and local comments work immediately. You can also import public GitHub repository metadata into a local showcase through GitHub's unauthenticated REST API. Example projects and community profiles are **sample data**, not real live DevShow users.

**Not implemented yet:** secure accounts and GitHub OAuth, shared cross-user data, real server-side comments/likes, notifications, moderation, hosted media uploads, and production rankings. Those require the planned backend below. This site must not be marketed as a functioning multi-user social network until the API is deployed and integrated.

## New in v1.5

The redesigned Discover page now includes a launch-style hero and featured-project spotlight. A **Creator Studio** gives each browser its own project manager, editable project metadata, external cover images and versioned build logs. **Collections** let you organize and revisit projects, and **Settings** now has versioned JSON **Export / Restore** so you can manually transfer your work across devices. Mobile users can access all navigation via **More**.

See [v1.5 release notes](docs/UPGRADE-v1.5.md) and [release history](docs/RELEASES.md). This version still does **not** provide shared user accounts, live activity, or real globally visible posts.

## Getting started

Option A: open `index.html` in a browser. Basic features work, but some browsers restrict JavaScript modules loaded from `file://`. **Recommended:** use an HTTP server:

```bash
# From the project folder
python -m http.server 8080
# Open http://localhost:8080
```

Alternatively:

```bash
npx serve .
```

No build step or Node dependency is required for the frontend. To run smoke tests with Node 22+, execute `npm test`.

## One-file alternative (especially useful on mobile)

The separate downloadable `DevShow-single-file.html` standalone release is the same v1.5 frontend with CSS, demo data, and JavaScript combined into one file. Rename it to **`index.html`** and upload it to the repository root if you want the fastest possible GitHub Pages setup. You can migrate to the modular source tree later. The single-file edition supports the same local-demo behavior; the architecture documentation remains in the ZIP.

## Publish to GitHub Pages (no Cloudflare)

1. Upload all project files (including `.nojekyll`, `src/`, `assets/`, `styles.css`, and `index.html`) to the root of a public repository, e.g. `SillyDev2026/DevShow.io`.
2. On GitHub, open **Settings → Pages → Build and deployment**.
3. Choose **Deploy from a branch**, branch **main**, folder **/(root)**, then **Save**.
4. Your published site will appear at **https://sillydev2026.github.io/DevShow.io/** after GitHub completes the deployment.
5. If you own the `devshow.io` domain, configure it as a **custom domain** in Pages, then add the DNS records required by GitHub. Naming the project DevShow.io does not mean the domain is registered or connected.

**Why branch Pages works:** All assets are relative paths and the frontend uses hash-based routes (`#discover`, `#explore`, etc.), so refreshing a page never requires server rewrite rules. The `.nojekyll` marker disables Jekyll processing.

GitHub Pages serves **static** content, not an API. Keep secrets and OAuth callbacks off Pages. Hosting options for a future Node.js API include a traditional VPS or a Node-compatible backend host, paired with managed PostgreSQL; none requires Cloudflare.

## Project structure

```text
DevShow.io/
├── index.html              # Semantic HTML entry / social metadata
├── styles.css              # Design system and responsive layouts
├── src/
│   ├── app.js              # Rendering, navigation, state, event handlers
│   └── data.js             # Categorization and sample community projects
├── assets/
│   └── favicon.svg
├── docs/
│   ├── ARCHITECTURE.md     # Production full-stack design
│   └── RELEASES.md         # v0.1→v1.0 scope and status
├── tests/smoke.mjs       # Dependency-free Node smoke tests
├── package.json          # Optional npm test command
├── .nojekyll
├── .gitignore
└── README.md
```

## Functional feature checklist

- [x] Discover and explore feeds with creative thumbnails
- [x] Search by title, description, tag, category, or creator
- [x] Category filters; trending, newest, and most-liked sorting
- [x] Project details, outbound repository and website links
- [x] Like and bookmark projects using local browser storage
- [x] Creator pages, local follow/unfollow and following feed
- [x] Leaderboard based on **sample** engagement values
- [x] Publish and delete local projects
- [x] Import public GitHub repo metadata (online, rate-limit dependent)
- [x] Local comment posting and editable demo profile
- [x] Theme toggle, keyboard search shortcut (Ctrl/Cmd+K), accessible dialogs
- [x] Mobile bottom navigation and responsive grids
- [ ] Production GitHub OAuth / persistent server-side users
- [ ] Shared cross-device publications, comments, votes, follower graph
- [ ] Real notification delivery, ranking integrity, media uploads
- [ ] Moderation tools, audits, spam controls, production telemetry

## Privacy and security

The demo stores local data in `localStorage` under `devshow-v1-local-demo`. The **Reset demo data** button in Settings clears it. Import requests go directly from your browser to `https://api.github.com/repos/...`; this client does not ask for or store a GitHub token. User content is HTML-escaped before insertion into the DOM, outbound links are limited to HTTP(S), and external links use `rel="noopener noreferrer"`. This is still a prototype and has **not** undergone a production security audit.

## Planned backend

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for API contracts, authentication, database model, moderation, deployment, and the migration from local demo to shared multi-user platform.

## License

This starter is supplied as an editable project package. Choose a license before accepting public contributions.
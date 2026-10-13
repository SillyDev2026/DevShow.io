# DevShow.io — v1.5

**Discover what developers are building.** DevShow is a responsive developer showcase frontend for web, Roblox, game development, open source, AI, apps, and creative tools.

## Current GitHub release

This repository currently hosts the **v1.5 standalone GitHub Pages edition**:

```text
DevShow.io/
├── index.html       # Complete v1.5 frontend, CSS, sample data, and JavaScript
├── .nojekyll        # Disable Jekyll processing
└── README.md
```

The standalone edition contains the same frontend functionality as the larger modular v1.5 project package. It is fully self-contained and requires **no Node.js, build step, Cloudflare, or API server** to display.

## What works

- Responsive discovery and explore feeds with sample developer projects
- Project search, category filters, sorting, and detail dialogs
- Creator Studio: add, edit, and remove your local projects
- Public GitHub repository metadata import (subject to GitHub API limits)
- Custom cover URLs, development updates, and version/build logs
- Saved projects and custom collections
- Profile editing, local following, likes, and comments
- Leaderboards with **sample engagement**, not live community scores
- Dark/light theme, keyboard shortcuts, and mobile navigation
- Local JSON data export and restore

### Local-demo limitations

DevShow is **not yet a live multi-user social network**. Posts, reactions, comments, follow relationships, and collections persist in your own browser via `localStorage`; they are not shared with other visitors. The site includes sample creators and projects.

GitHub OAuth, real accounts, cross-device synchronization, database storage, live notifications, moderation, and server-side leaderboards will require a separate backend. Never put GitHub OAuth client secrets or database credentials in this GitHub Pages repository.

## Hosting with GitHub Pages

1. Open **Settings → Pages** for this repository.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Choose `main` and `/(root)`; click **Save**.
4. Once published, the expected address is **https://sillydev2026.github.io/DevShow.io/**.

A separate `devshow.io` domain is not automatically connected; its registration and custom-domain DNS setup would be separate steps.

## Development

Open `index.html` in a browser, or serve the folder through a static web server:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

The modular source edition and smoke tests are included in the separately delivered **DevShow v1.5 complete source package**. This repository's current published entrypoint is intentionally the one-file edition, which is easiest to deploy and edit from a phone.

## Security and licensing

The browser handles local project data. Public GitHub import uses GitHub's public API without requesting access tokens. This is a frontend prototype, not a production security audit. Choose a license before accepting external contributions.

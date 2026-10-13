# DevShow v2.2.0

## Features

- Public social discovery feed, with query, category and sort parameters.
- Visibility levels: public, unlisted and private with owner-enforced reads/writes.
- Non-destructive SQLite migrations for `projects.visibility` and `users.pinned_project_id`.
- Pinned public portfolio project on developer profiles.
- GitHub repository metadata proxy: stars, forks, topics, license, issues, pull requests and releases.
- Server-side GitHub repository import, rate-limit guidance and URL allowlisting.
- Deep links for unlisted public-viewable projects with separately fetched discussions and updates.
- Deployable Docker image with a `/data` SQLite volume and dedicated deployment guide.
- New visibility and cross-account authorization tests, plus a CI workflow.

## Privacy contract

Public projects appear in search, stats and other users' profiles. Unlisted projects require a URL with their ID and cannot be enumerated in the feed. Private projects are only available to the owner through authenticated API requests; attempts by other viewers return 404. Open-source repository URLs are never treated as private storage.

## Operational caveats

The Node server must be deployed separately with HTTPS, persistent disk, CORS origins, and backups. `config.js` stays blank until the server hostname exists. No GitHub OAuth, email verification or password reset is included. The Windows desktop build is a local instance, not an internet-hosted service.

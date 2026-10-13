# DevShow release history

## v2.5.0 — Clean architecture rebuild

- Rebuilt GitHub Pages frontend as 4 small ES modules rather than a single large controller.
- Removed local fake-user/demo persistence and duplicated offline-vs-online state; authoritative SQLite-only records.
- Refactored Node API into security/project/router/server modules and retained compatible v2.2 endpoints.
- Refreshed desktop/mobile UI, project manager, profile editor, collection board, build logs, notifications and discover feed.
- GitHub project import, repository metadata, issues/PR/release links, account export and password rotation retained.
- Updated Windows SEA build source, tagged Release workflow and deployment instructions.
- Preserved SQLite schema and non-destructive v2.0/v2.2 migrations.
- Expanded smoke checks and carried forward the API/privacy regression tests.

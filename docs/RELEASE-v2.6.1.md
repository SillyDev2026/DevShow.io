# DevShow v2.6.1 — Quality of life and desktop stability

## Improved Windows download

- Builds from `main` and tags matching `v2.6.*` using the Windows GitHub Actions runner.
- Validates the actual standalone executable with `--self-test` and `--version`.
- Publishes `DevShow-Desktop.exe` and its `.sha256` checksum directly to the `desktop-latest` prerelease. No ZIP extraction is required for end users.
- The website fetches the `desktop-latest` release metadata and displays a direct download only if an uploaded EXE is confirmed.
- GitHub Releases URLs: [Desktop latest](https://github.com/SillyDev2026/DevShow.io/releases/tag/desktop-latest), [Windows workflow](https://github.com/SillyDev2026/DevShow.io/actions/workflows/windows-exe.yml).

## Better local startup

- Launcher's preferred port: `127.0.0.1:3217`, falling back to a free loopback port if occupied.
- Desktop options: `--version`, `--self-test`, `--no-browser`.
- `DEVSHOW_DESKTOP_PORT`: optional requested port; `DEVSHOW_DATA_DIR`: custom application data directory. `DB_PATH` still overrides the database file path.
- The private DB defaults to `%APPDATA%\DevShow\data\devshow.sqlite`.
- The self-test now validates that the embedded web UI can be served as well as that SQLite can open.

## Website and API QoL

- Download screen checks GitHub release assets, reports release availability, and links to a SHA-256 checksum when present.
- API address changes are preflight-tested against `/api/health` before saving the new origin.
- Settings also has a separate Test connection button; error messages keep the existing connection unchanged.
- Fluid desktop/tablet/mobile design from v2.5.1 is retained.

## Checks

- `npm test` (31 Node.js tests + static smoke checks).
- `node tools/desktop-entry.mjs --self-test` (SQLite and local website).
- Port-collision fallback tested on Linux with a real bound port.
- GitHub Actions must build and run the *Windows executable* to confirm Windows compatibility; source-only tests cannot prove that the Windows binary works.

### Security and deployment notes

The local executable does not expose a public API and binds to `127.0.0.1`. Accounts/projects saved in the EXE are on that PC and are not synchronized with the public community. A hosted HTTPS API with durable storage is required for shared accounts. The EXE is unsigned unless Windows code signing is separately configured; SmartScreen may present a warning. Do not bypass Windows warnings without verifying the GitHub repository, checksum, and executable publisher.

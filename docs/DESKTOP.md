# DevShow Desktop v2.1 — Windows EXE

The Windows application is a single self-contained `DevShow-Desktop.exe` built with Node.js 26's Single Executable Applications (SEA). The release pipeline is `.github/workflows/windows-exe.yml`. No ZIP or separate Node.js installation is needed by end users.

## How to use it

Download from the **Windows app** page on DevShow. The page queries the GitHub Releases API and uses the direct download URL only after the published release contains the EXE.

Run it on Windows 10/11 x64. A console window starts a private server and opens the website at `http://127.0.0.1:3217`. Create a local account and save projects, profiles, updates, collections and comments. Leave the console open while using the app; close it to stop the server.

Data persists at `%APPDATA%\DevShow\data\devshow.sqlite`. Back up this directory before migrating computers.

**Important:** This is a **local PC server**. It does not automatically sync with the GitHub Pages website on other users' computers. Public cross-device profiles require a separately hosted HTTPS Node API and persistent database. The desktop and hosted accounts are separate.

The downloadable executable is currently **unsigned**. Windows might show an unknown-publisher warning. Check the source and release details before running software; don't disable security protection for untrusted files.

## Build from source (Windows, Node.js 26)

```powershell
npm test
npm run build:desktop
node --build-sea dist/sea-config.json
.\dist\DevShow-Desktop.exe --self-test
```

The GitHub Actions workflow runs tests, compiles the executable on `windows-latest`, verifies its self-test, and uploads the **.exe directly** to GitHub Releases under tag `v2.1.0`.

New API endpoints: `GET /api/me/export` (signed-in account backup, excluding secrets); `POST /api/me/password` (current-password confirmation and invalidation of sessions); `GET /api/stats` (counts).

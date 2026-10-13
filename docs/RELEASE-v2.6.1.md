# DevShow v2.6.1
Windows EXE workflow now builds on main, supports v2.6.* tags and uploads direct assets to the desktop-latest GitHub prerelease.
The website only offers the download after verifying the uploaded asset through GitHub Releases.
API settings can check the server identity and version before saving a new origin.
The local launcher falls back to an available port, supports --version, --no-browser and --self-test, and persists data under the user's Windows AppData directory.
Run npm test (31 tests), and execute the Windows workflow for actual EXE verification.
Local EXE storage does not automatically synchronize with a public API. Unsigned binaries can generate Windows SmartScreen warnings; verify their GitHub origin and checksum.

# DevShow v3.0.1 — Adaptive SQLite compression

Inspired by the adaptive/expansion-safe principles in SillyDev2026/Compression for Roblox; **not wire-compatible** with that Luau module.

New collaborative document content and previous revisions, and desktop-sync drafts/notes/preferences, automatically use Brotli or DEFLATE when the entire encoded TEXT value is smaller. Small or noncompressible content stays raw. Old uncompressed fields remain readable; APIs still return source text and ordinary JSON. This does not change SQLite schema or indexes.

Frames use the record-separator-prefixed marker DEVSHOW.Z1, magic DSZ1, codec byte, uncompressed byte length, truncated SHA-256 checksum and Base64 payload. Decoding validates format, checksum, UTF-8 and strict decompressed-byte limits. Checksums detect accidental corruption but are not authentication. Existing shared-document permissions and revision conflicts remain enforced.

## Compact old data

With the application stopped, run:

```bash
npm run storage:compact -- --db=/absolute/path/devshow.sqlite
npm run storage:compact -- --db=/absolute/path/devshow.sqlite --apply
```

The second command creates a timestamped consistent SQLite backup before rewriting legacy compressible values, and runs VACUUM to reclaim free pages. Windows data normally lives in %APPDATA%\DevShow\data\devshow.sqlite. Keep the backup until restored files are verified. Run only with the server stopped.

Run `npm test` for codec, migration and API integrity checks. The Windows workflow builds the Node 26 standalone EXE and runs --self-test including codec roundtrip. Actual database disk savings vary with content and WAL/page allocation.

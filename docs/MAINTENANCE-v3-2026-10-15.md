# DevShow v3 maintenance audit — October 15, 2026

## Implemented and tested in this follow-up

- Browse and advanced discovery searches now escape literal percent, underscore and backslash characters in SQLite LIKE queries, without treating them as wildcards.
- Notification inbox cursors are acknowledged only **after** the application processes the fetched pages. An interrupted callback can retry without silently losing notifications; invalid and stalled cursors are rejected.
- Notification visibility now includes active members of private collaborative projects, but pending invitees can read only their own invitation notification. Removing membership revokes private-project notification visibility.
- Desktop status now reports the actual v3.0.1 version.
- Shared-editor source changes are written to a local device recovery draft, scoped to the server, signed-in account, project and document. The user may explicitly restore or discard a previous draft on reopening a file.
- Conflicting local drafts never replace a newer server revision automatically. The editor preserves the originally saved base revision across recovery and lets the user copy and manually reconcile the conflicting text.
- Network save failures keep a device draft and retry with exponential backoff up to 20 seconds. Successful saves clear that specific device draft.
- Deleting a file while it has unsaved edits is blocked.
- Added regression coverage for search escaping, private notification visibility, inbox acknowledgment/retry, account-scoped drafts and desktop packaging.

## What this is not

The broader 41-feature v3.0 roadmap has **not** been fully built or verified. This is a second maintenance and reliability patch on top of the v3.0.1 shared-editor foundation. CRDT/OT simultaneous keystroke merging, integrated voice chat, full AI coding and reviews, automatic bidirectional offline database replication, a verified extension marketplace and a fully managed production backend remain unimplemented. Avoid labeling those features shipped.

## Important device-draft privacy notice

Recovery drafts are stored in **this browser's localStorage**, unencrypted and local to the device. They are separated by server URL, account and file identifiers, and expire from recovery after 30 days. Do not use this feature for confidential source files on shared or untrusted devices. Server-side collaborative source remains in SQLite and retains its separate compression, membership and revision controls.

A device draft is not a remote backup or a substitute for database backups. If the browser's site data is cleared, its drafts are also erased. The server must be online for colleagues to fetch saved revisions. Resolve any concurrent editing conflict manually.

## Release validation

Run `npm test`, `npm run test:desktop` and the Windows GitHub Actions workflow. The release ZIP and EXE should only be labeled verified after their job completes, validates the standalone executable and publishes assets from the exact commit.

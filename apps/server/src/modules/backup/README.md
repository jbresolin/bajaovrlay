# apps/server/src/modules/backup

The backup download (BAJAOVRLAY-33): at a session break the operator clicks "Baixar" in
"Cópia de segurança", and the browser saves one zip of the data folder onto a USB stick.
A download, because on the stream PC the server runs in Docker, which cannot see the stick.

Start at `backupDownloads.ts`: one backup at a time; it copies the database with SQLite's
online backup (`core/db/databaseBackup.ts`, shared with the nightly command) into a
temporary file, streams the zip (`backupZip.ts`, yazl, stored not compressed), and once
the last byte went out records it with recordBackup as `sistema:backup`
(`reducers/recordBackup.ts`: no slice changes, the row is logged all the same).
`backupContents.ts` lists media/ and recordings/ and measures each part; `backupFileName.ts`
names the zip in São Paulo's time; `backupReadMe.ts` writes leia-me.txt. `api.ts` declares
GET /api/v1/backup and /backup/summary, which `api/v1/mountBackupRoutes.ts` mounts.
Restoring is by hand, documented in `deploy/stream-pc/README.md`. `index.ts` lists exports.

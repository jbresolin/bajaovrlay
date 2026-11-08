# apps/server/src/modules/backup

The backup download (BAJAOVRLAY-33): at a session break the operator clicks "Baixar" in
"Cópia de segurança", and the browser saves one zip of the data folder onto a USB stick.

Start at `backupDownloads.ts`: one backup at a time; it copies the database with SQLite's
online backup (`core/db/databaseBackup.ts`, shared with the nightly command) into a
folder `temporaryDatabaseCopies.ts` names (and sweeps at boot), streams the zip
(`backupZip.ts`, yazl, stored), stops it when the request is cancelled or the reader takes
no byte for a minute, and once the last byte went out records it with recordBackup as
`sistema:backup` (`reducers/recordBackup.ts`). `backupContents.ts` lists and measures
media/ and recordings/; `backupFileName.ts` names the zip; `backupReadMe.ts` writes
leia-me.txt. `api.ts` declares the two routes, which `api/v1/mountBackupRoutes.ts` mounts.
Restoring is by hand, documented in `deploy/stream-pc/README.md`. `index.ts` lists exports.

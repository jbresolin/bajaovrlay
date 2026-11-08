# packages/shared/src/backup

The shared side of the backup download (BAJAOVRLAY-33): one click on "Cópia de segurança"
saves the database, the media and the recordings as one zip, which the operator puts on a
USB stick. Start at `backupSummary.ts`: what GET /api/v1/backup/summary answers (the size of
each part, the newest backup) and the download's query.

`backupCommands.ts` is recordBackup, sent only by the server (`sistema:backup`) when a zip
was sent whole; it changes no slice, and its event-log row is the record of the copy.
`latestBackup.ts` reads "Última cópia" from those rows, and `backupSizeText.ts` writes a
size as the operator reads it ("48 MB"). `index.ts` lists every export.

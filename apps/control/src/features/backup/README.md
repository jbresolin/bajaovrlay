# apps/control/src/features/backup

"Cópia de segurança" in the page header (BAJAOVRLAY-33): at a session break the operator
saves the database, the images and the recordings as one zip onto a USB stick. Start at
`BackupDialog.tsx`: the button, and the dialog with "Incluir gravações", the expected
size, "Baixar" and "Última cópia: 14:32, 48 MB".

`fetchBackupSummary.ts` asks GET /api/v1/backup/summary for the size of each part and the
newest backup, and builds the address "Baixar" links to; the browser downloads the zip
itself, so it never passes through the page's memory. `latestBackupText.ts` writes "Última
cópia" on the operator's clock. A copy made since the dialog opened arrives in the live
event log (`chooseTheLatestBackup` in @bajaovrlay/shared). Restoring a copy is by hand:
deploy/stream-pc/README.md, "Restaurar uma cópia".

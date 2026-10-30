# apps/control/src/features/entityLibrary

The "Cadastros" page (#/cadastros, BAJAOVRLAY-19): the entity library on a desktop or a tablet.
Start at `EntityLibraryPage.tsx` (the images' summary, `MediaFolderSummary.tsx`, and one tab per
kind) and `EntityTab.tsx` (toolbar, `EntityTable.tsx`, and a side panel:
`EntityRecordFormPanel.tsx` or `EntityCsvImportPanel.tsx`). The form's fields and how they read
are `entityRecordForm.ts`; an image uploads at once (`EntityImageField.tsx`, `imageUpload.ts`),
and "Salvar" stays off until every upload of the form has ended (`imageFieldsStillUploading.ts`,
shared with the item editor).

CSV columns (`entityCsvColumns.ts`, `;` or `,`, header first, images never): Equipes `carro*`,
`equipe*`, `escola*`, `escola_completa`, `cidade`, `uf`; Pessoas `id`, `nome*`, `funcao*`,
`carro`; Patrocinadores `id`, `nome*`, `cota*` (diamante, ouro, prata, bronze, apoio, realizacao; "master" read as diamante), `peso*`
(1–10); Programação `id`, `sessao*`, `prova*`, `inicio*`, `fim`, `local` (dates "14/11/2026
10:00", this computer's clock). A known key updates, keeping images and any field whose
column the file lacks; a blank id is new.
`entityCsvImport.ts` builds the preview, `entityCsvExport.ts` the export and the examples, and
`SimulatorTeamsImportButton.tsx` loads the simulator's fictional teams.

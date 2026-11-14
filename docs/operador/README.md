# docs/operador — the operator guide and its rehearsal

For the volunteers who run a race day's graphics, in pt-BR (BAJAOVRLAY-31). Start reading at
`guia-do-operador.md`, the one A4 sheet (both sides) left beside the keyboard, then `ensaio.md`,
the 45-minute rehearsal João runs with two volunteers to prove the sheet is enough.

- `guia-do-operador.pdf` — the sheet to print, made from the guide; never edited by hand.
- `imagens/` — the guide's five pictures, retaken from the real console by `screenshots.e2e.ts`
  (a server of its own with the simulator; `picturesOfTheGuide.ts` names them).
- `guidePrintsOnTwoPages.e2e.ts` — prints the guide to A4 (`printableGuide.ts`,
  `guia-impressao.css`) and fails past two pages; it also runs with the control page's browser tests.
- Retake the pictures and the PDF: `pnpm build`, then `pnpm --filter @bajaovrlay/control operator-guide`.
- Every label the guide and the rehearsal quote between straight double quotes must exist in the
  pt-BR catalogs: `apps/control/src/i18n/operatorGuideLabels.test.ts`. Write anything else without them.

# packages/shared/src/programHistory

Undo on program (BAJAOVRLAY-30, concept §7 rule 5). `programHistory.ts` is the saved slice:
per layer, what its program output showed before each of its last ten changes, an item with
the values typed for it or "vazio". `undoCommands.ts` holds the two commands that read it:
`undoOnLayer` ("Desfazer" on a Camadas row) and `undoLastChangeOnProgram` ("Desfazer
última", Ctrl+Z), which puts back every layer the newest change touched.

Start with `programHistory.ts`. The server writes the slice in one place after every
command (apps/server/src/core/store/programHistory/), and its undo reducers live there too.

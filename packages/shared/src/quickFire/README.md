# packages/shared/src/quickFire

Quick-fire panels: named grids of buttons, one per item, for what the operator fires
ad hoc. Start reading at `quickFirePanel.ts` (the `quickFirePanels` slice: id, name,
order). A panel holds no list of items; an item says it lives in a panel through its
`home` (`../rundown/itemHome.ts`), and `listItemsOfQuickFirePanelInOrder` in
`../rundown/itemsOfHomeInOrder.ts` lists a panel's buttons first to last.

One file per command (`createQuickFirePanel.ts`, `renameQuickFirePanel.ts`,
`deleteQuickFirePanel.ts`), all in the `Command` union of `../commands/command.ts`;
their rules live in the server's reducers. Moving an item into or out of a panel is
`moveItemToHome`, which lives with the other item commands in `../rundown/`.

`index.ts` lists every export of this folder; the package's `src/index.ts` re-exports it.

# apps/control/src/features/quickCarPick

"Escolher carros" (BAJAOVRLAY-82): an item's cars (the battle card's two) picked from the console
without the item editor, by number or "Disputa pela posição", then "Prévia" or "No ar". Start at
`QuickCarPickPopover.tsx` (the box under a quick-fire button or rundown row, and the button's chevron),
then `QuickCarPickBox.tsx` (`NumberBox.tsx` is one box, `QuickCarPickSourceLine.tsx` the source line).

- `carGroupsToPickQuickly.ts` — which items get it (never an event template) and with which boxes;
  `quickCarPickStart.ts` — what the box opens with, and its source (or why there is none).
- `positionsOfTheSource.ts` — the positions, corrections included; `carsNowReadOut.ts` — "Agora: …".
- `quickCarPickChecks.ts` (+ `wholeNumberTyped.ts`) — each box checked before anything is sent.
- `useSaveCarPicksIntoItem.ts` — the one `updateItemFields`, built by features/schemaForm's
  `buildItemFieldsOfCarPicks`; `useRefreshPreviewOfItem.ts` re-previews an item holding the old cars.
  The take or preview after them is the button's or row's own, through features/autoPreview.

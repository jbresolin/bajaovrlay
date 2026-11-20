# apps/control/src/features/quickCarPick

"Escolher carros" (BAJAOVRLAY-82): an item's cars (the battle card's two) picked from the console
without the item editor, by number or "Disputa pela posição", then "Prévia" or "No ar". Start at
`QuickCarPickPopover.tsx` (the box under a quick-fire button or rundown row, and the button's chevron),
then `QuickCarPickBox.tsx` (the boxes, the read-out and the two buttons; `NumberBox.tsx` is one box).

- `carGroupsToPickQuickly.ts` — which items get it (car groups a car of the positions fills; never an
  event template) and with which boxes; `quickCarPickStart.ts` — what the box opens with, and the source.
- `positionsOfTheSource.ts` — the positions, corrections included; `carsNowReadOut.ts` — "Agora: …".
- `quickCarPickChecks.ts` — each box checked before anything is sent, in pt-BR.
- `useSaveCarPicksIntoItem.ts` — the one `updateItemFields`, built by features/schemaForm's
  `buildItemFieldsOfCarPicks` (the editor's own car-picker bindings); the take or preview after it is
  the button's or row's own, so it goes through features/autoPreview like any other take.

# apps/server/src/core/store/consoles

Two consoles on one layer (BAJAOVRLAY-69). A take from a console is refused only when
another console changed that layer less than 2 s ago and the taking console had not seen it
yet; everything else (one operator's quick presses, macros, triggers, the command API) goes
through as before.

- `unseenChangeByAnotherConsole.ts` — the rule and its refusal: start reading here. The four
  take reducers (takeItem, takeNext through it, takePreview, takeAllPreviews) call it.
- `lastProgramChangeOfEachLayer.ts` — what the rule reads: each layer's last program change
  and which console made it. The store keeps it in memory beside the slices and updates it
  after every saved command (createStateStore.ts); the reason it is not a slice is there.

The console id comes from the WebSocket hub (core/ws/consoleOfConnection.ts).

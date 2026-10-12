# apps/server/src/core/store/updateRules

Named pure rules that run on every `updateInstanceData` of a graphic whose manifest asks
for one in `v_baja.updateRule`. A rule sees the data on air and the fields of the update
and hands back the fields to write; it reads no clock and does no I/O. Start reading at
`updateRuleTypes.ts` (the contract), then `updateRuleRegistry.ts` (the list of rules).

- `carryClockForward.ts` — the race clock's rule: an update that stops, starts, turns or
  corrects the clock also writes the time on screen at that moment, so it never jumps.
- `updateRuleOfGraphic.ts` — reads a manifest: no rule, a usable rule, or why not (an
  unknown name, or a data schema without the fields the rule needs).
- `index.ts` — what the reducer and the boot import.

Run by `reducers/updateInstanceData.ts` after nulls and stamps, before the "nothing changed"
and schema checks; never on a take. A rule that cannot be run is warned about at boot.

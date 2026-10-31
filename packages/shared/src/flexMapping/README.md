# packages/shared/src/flexMapping

How a flex source's JSON becomes the canonical shapes. Pure code, so the server's httpJson
adapter and the page's "Testar" panel run the same `applyFlexMapping`. Start there, then
`flexMappingConfig.ts` (one mapping per shape, one rule per field with exactly one source;
the extra sources in `flexRuleSources.ts`, the mapping's options in `flexMappingListOptions.ts`,
their checks in `flexShapeMappingChecks.ts`), `flexListEntryMapping.ts` (one entry),
`valuePath.ts` (the hand-written path parser), `mappableFields.ts` and `ptBRFlexMapping.ts`
(every text). `examples/` holds a fictional preset and fixture, and `examples/bajaApp/` the
Baja app's real answers (BAJAOVRLAY-53; its draft presets are test support until BAJAOVRLAY-54).

What a mapping can do, generic on purpose (no source's word is written in this code):
**alternatives** (`firstOf`: the first value present, not null, not blank wins);
**lookups** (a list from another request joined by key, one level, strict equality;
`flexLookups.ts`); **nested lists** (`nestedEntriesPath`, rules read the outer element with
`fromParent`; `flexEntryElements.ts`); **table columns** (a cell read by its column's header,
standings' parts from picked headers; `flexTableColumns.ts`); **refusal by a flag**
(`refuseWhen`: the poll fails with the operator's sentence, the last snapshot stays;
`flexRefusalFlag.ts`); **gaps from laps** (`workOutGapsFromLaps` with `lastPassAtMs`; the gaps
are as of the last line crossing; `gapsFromLaps.ts`); **brackets** grouped into rounds, the
first incomplete round left out with the rounds after it (an incomplete third place alone)
and a third place after the final moved before it (`bracketRoundsContracts.ts`).
**Every text written is cleaned up** for every flex source: HTML entities decoded, spaces
collapsed, ends trimmed (`sourceTextCleanup.ts`). A disqualified team's mapped rank is dropped.

Limits, on purpose. **Paths** are keys and `[n]` indices only, no wildcards, filters or
functions; a key holding a dot or a bracket, and a response whose top level is a list,
cannot be read. **One transform per rule**, no chains. **One level of lookup.**

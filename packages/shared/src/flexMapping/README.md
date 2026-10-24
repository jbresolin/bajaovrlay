# packages/shared/src/flexMapping

How a flex source's JSON becomes the canonical shapes. Pure code, so the server's httpJson
adapter and the page's "Testar" panel run the same `applyFlexMapping`. Start there, then
`flexMappingConfig.ts` (one mapping per shape, one rule per field with exactly one source),
`valuePath.ts` (the hand-written path parser), `mappableFields.ts` (the fields a rule may
fill) and `ptBRFlexMapping.ts` (every text). `examples/` holds a fictional preset and fixture.

Limits, on purpose. **No joins across requests:** a shape reads one response, and positions
and standings need team and school on every entry, so names sent in another endpoint cannot
be mapped; the fix is upstream (BAJAOVRLAY-18's endpoint spec), and the entity library
(BAJAOVRLAY-19) may later fill names by `carNumber`. **Paths** are keys and `[n]` indices
only, no wildcards, filters, recursion or functions; a key holding a dot or a bracket, and a
response whose top level is a list, cannot be read. **One transform per rule**, no chains.
**Brackets** (a draft, BAJAOVRLAY-25) are not mappable yet. A standings team's **score parts** come
as one list per team, each part `{ "label", "value" }`; the label is the part's id, and the
standings' `scoreParts` is built from every label met, in order (`standingsScorePartLists.ts`).

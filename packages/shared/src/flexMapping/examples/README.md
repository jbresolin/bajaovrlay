# packages/shared/src/flexMapping/examples

**Fictional.** An imaginary timing system and the preset that maps it; no real system sends
this, and the 20 teams are the made-up ones of the simulator (`teams.fictional.json`, car n
being its n-th team). Never show it as real results.

- `timing-system-like.response.json`: a response whose shape is deliberately not ours:
  Portuguese keys, car numbers as text, lap times as "4:38.293", status codes (`PISTA`,
  `BOX`, `PARADO`, `ABAND`), a moment with its zone, no position numbers (the list is in
  order) and a null gap for the leader.
- `timing-system-like.config.json`: the flex source config that maps it into positions and
  session. Its `mappings` are checked by `FlexMappingConfigSchema`; the whole file, with its
  `requests`, by the httpJson config schema.

Both are the fixtures of `applyFlexMapping.test.ts` and of the flex source's e2e test.

The response is a fixed snapshot of one instant ("gerado_em", 20 March 2027, with the
session clock running). That is right for a pasted sample in "Testar", but served as it is
to a live source, the session clock would count from that far-off moment; so
`pnpm serve:flex-example` stamps each answer with its own moment (`scripts/liveExampleResponse.js`).
The e2e timing system serves it unchanged, since that test reads the positions table only.

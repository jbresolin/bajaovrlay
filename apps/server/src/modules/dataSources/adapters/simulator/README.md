# apps/server/src/modules/dataSources/adapters/simulator

The `simulator` adapter: a **simulated** Baja enduro (about 60 cars, four hours, pit
stops, breakdowns, yellows, a rare red, the checkered flag) answered as session,
positions and overall standings, so graphics can be rehearsed with nobody typing data.
It is **not** the real Baja SAE Brasil scoring, and the teams in `teams.fictional.json`
are **fictional**: never show them as real results.

Start at `simulateEnduro.ts` (the race as a pure function of seed and simulated time),
then `lapTimes.ts`, `pitStops.ts`, `breakdowns.ts`, `flags.ts`, `raceOrder.ts`,
`standingsFromRaceState.ts`, `shapesFromRaceState.ts` and `simulatorAdapter.ts`. Every
draw comes from `seededRandom.ts`, never an unseeded generator (a test and ESLint enforce it).

Other scenarios (acceleration runs, suspension brackets) are a later item, each its own
`simulate<Scenario>.ts` with its shapes file, not a generic engine shared with this one.

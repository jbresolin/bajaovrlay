# apps/server/src/modules/dataSources/adapters/simulator

The `simulator` adapter: a **simulated** Baja enduro (about 60 cars, four hours, pit
stops, breakdowns, yellows, a rare red, the checkered flag, a few penalties and warnings)
answered as session, positions, overall standings and incidents, and beside it a **simulated
Super Prime** answered as brackets (BAJAOVRLAY-25: every car drawn into a seeded first round
padded with byes to a power of two, a heat each simulated minute, best of 3 from the
semifinals, the third place before the final; a round listed once all its cars are known),
so graphics can be rehearsed with nobody typing data.
It is **not** the real Baja SAE Brasil scoring, and the teams in `teams.fictional.json`
are **fictional**: never show them as real results.

Start at `simulateEnduro.ts` (the race as a pure function of seed and simulated time),
then `lapTimes.ts`, `pitStops.ts`, `breakdowns.ts`, `flags.ts`, `raceOrder.ts`,
`standingsFromRaceState.ts`, `simulatedIncidents.ts` (the made-up race direction),
`simulatedBracketDraw.ts` and `simulatedBracket.ts` (the Super Prime),
`shapesFromRaceState.ts` and `simulatorAdapter.ts`. Every
draw comes from `seededRandom.ts`, never an unseeded generator (a test and ESLint enforce it).
Three browser tests pick seeds for an early event (1405: a yellow at 16 min; 227: a penalty at
3 min; 2027 with ten cars: the Super Prime decided at 17 min); `seedsTheBrowserTestsRelyOn.test.ts`
fails if a change to the draws moves them.

Above 1× the session clock jumps at each poll (a reading has no speed; clients run it at 1×
between polls). Later scenarios each get their own `simulate<Scenario>.ts`, no shared engine.

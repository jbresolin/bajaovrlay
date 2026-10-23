# BAJAOVRLAY-22 walk: the design beside the product

`design/` holds crops of the design record's screenshots (PR #19, `docs/design/directions/ardosia/screenshots`,
cut to the card or the tower), so the pull request can show each one beside the product's
screenshot baseline: the race clock's seven baselines live in
`packages/graphics/race-clock/e2e/raceClockScreenshots.e2e.ts-snapshots/` and the tower's four in
`packages/graphics/positions-tower/e2e/positionsTowerScreenshots.e2e.ts-snapshots/`. The product
baselines are what the Playwright screenshot tests compare against; these crops are a review aid
only and no code reads them.

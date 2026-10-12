# packages/shared/src/clock

The race clock's arithmetic, kept in one place because two programs must agree on it:
the race clock graphic (which works out the time on every frame) and the server (which
works out the time on screen when an update must not make the clock jump).

Start reading at `clockExtrapolation.ts`: one reading ("at wall-clock time W the clock
read T") in, the clock time at any later moment out. `clockWholeSeconds.ts` says which
whole second the screen shows for that time (elapsed rounds down, remaining up).

**No imports allowed here.** Graphics import this folder as `@bajaovrlay/shared/clock`,
a separate entry in `package.json`, so their bundle carries these few lines and nothing
else of the shared package (no Zod). A file here that imports Zod, or anything from
another folder of this package, would put that code on air in OBS.

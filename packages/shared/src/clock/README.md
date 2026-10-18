# packages/shared/src/clock

The race clock's arithmetic and its "now", in one place because the graphic (every
frame) and the server (when an update must not make the clock jump) must agree on both.
Start at `clockExtrapolation.ts`: one reading ("at wall-clock time W the clock read T")
in, the clock time at any later moment out. `clockWholeSeconds.ts` says which whole
second the screen shows (elapsed rounds down, remaining up), and `clockFormatting.ts`
writes it as H:MM:SS, the same text on air and on the control page's session card
("Fontes"). `serverAlignedTime.ts` is
the shared "now": the renderer records the `serverNowMs` of each message, graphics call
`readServerAlignedTimeMs()` instead of `Date.now()`, and the offset between the two
clocks lives in one property of `globalThis` because renderer and graphic are separate
bundles. `serverClockOffsetSamples.ts` keeps the last five samples and their median.

**No imports from outside this folder.** Graphics import it as `@bajaovrlay/shared/clock`,
a separate entry in `package.json`, so their bundle carries these few lines and nothing
else of the shared package (no Zod). Anything else imported here would go on air in OBS.

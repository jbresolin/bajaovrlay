# packages/shared/src/raceTimeText

Race times written for the screen, in one place because the binding transforms (what an
operator applies to a bound field) and the positions tower (which writes its own gaps and
lap times) must cut the same way: to the tenth of a second, never rounded, with a decimal
comma (the gap rule of PR #17). Start at `raceTimeText.ts`: `writeSecondsToTheTenthCutAsText`
writes seconds ("12,3"), the body of a gap, and `writeLapTimeAsText` writes a lap
("4:38,2", "1:02:03,4" past an hour). Both take a whole number of milliseconds from 0 up;
the caller checks the input and adds the sign, the unit or the "volta(s)" word from its own
pt-BR catalog (the tower writes "+19,0" with no unit: its caps face has no lowercase "s").

**No imports from outside this folder.** Graphics import it as
`@bajaovrlay/shared/raceTimeText`, a separate entry in `package.json` like `./clock`, so
their bundle carries these few lines and nothing else of the shared package (no Zod).
`transforms/raceTimeTextTransforms.ts` imports the same functions for its two transforms.

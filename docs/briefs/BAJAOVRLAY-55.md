# Agent brief — BAJAOVRLAY-55: long text scrolls inside its box

Copied from the Plane work item's comments (2026-10-30 and 2026-10-31): the brief, then the
gate-2 fix-up round of PR #36 and João's change to its item 1. João accepted the Web
Animations exception for the gate-2 round.

**Today.** Two behaviours, neither good enough:

* **Cut with an ellipsis:** the tower, standings, bracket, lower strip, sessions board, the clock card's title and the wide board's event line. The ticker limits messages by characters instead.
* **No limit at all:** the lower third, team card, battle card, notice and countdown set `nowrap` with no maximum width. A long name ("Universidade Tecnológica Federal do Paraná - Cornélio Procópio") pushes the pill off the safe area.

João's ruling: every text box has a maximum (or fixed) width, and text that doesn't fit scrolls inside it instead of being cut.

### Build

1. **A kit part, `scrollingTextWhenTooLong`.** It is a Lit directive or a small element, whichever reads plainer.
   * It wraps one line of text in a clipped box and measures whether the text is wider than the box.
   * Text that fits is drawn as today and never moves.
   * Text that is too long runs this cycle:
     + holds at its start for `--motion-text-hold-start`;
     + scrolls at a constant `--motion-text-scroll-speed` (px per second, so a long name takes longer, never faster) until its end shows;
     + holds at its end for `--motion-text-hold-end`;
     + snaps back to its start with a short crossfade (`--motion-text-return`);
     + starts again.
   * The tokens go in the theme with sensible starting values: a 2.5 s hold at the start, about 60 px/s, a 1.5 s hold at the end and a 250 ms return. João tunes them on screen.
   * Only `transform` moves (compositor-friendly in OBS). The box keeps a soft fade at its clipped edge while the text is scrolling, and none at rest.
2. **One clock per graphic.** All the scrolling texts of one graphic start their cycle together and restart together, so a tower of 20 rows reads calm, not chaotic. A text that becomes too long joins at the next cycle start.
3. **Measured again** when the text changes (a live update) and when the box resizes (the tower's columns, the flag band). A change during a scroll restarts that text at its start, with no jump of the box.
4. **Rest states:**
   * `skipAnimation`, a reloaded page and every screenshot show the text at its start. Screenshots stay deterministic; the existing ones should not change except where an ellipsis turns into a cut-off start.
   * The cycle stops when the graphic is stopped or disposed: a timer-stop test that fails without the stop.
5. **Use it everywhere a text can be too long.**
   * Replace each ellipsis listed above.
   * Give the unbounded ones a maximum width from the theme, so the pill no longer grows past the safe area.
   * Team, school and person names, session names, the event line, and sponsor names where they are text.
   * The ticker keeps its 50-character limit: its message is the whole point of the bar.
6. **Kit README.** When to use it, and that an ellipsis is no longer used on air.

### Tests (first)

* Unit tests of the cycle's timing as a pure function: from the text's and the box's widths and the tokens, the phase at a moment. They cover:
  + text that fits;
  + text 1 px too long;
  + a very long name;
  + a change during a scroll;
  + one clock shared by three texts.
* No test waits on real GSAP or real time: use the kit's finish helpers and fake time.
* One Playwright test per graphic family (tower, standings, lower third, team card, bracket) with the real long Baja names: "Universidade Tecnológica Federal do Paraná - Cornélio Procópio" and "Instituto Federal de Educação, Ciência e Tecnologia Fluminense - IFF - Campus Itaperuna". Each proves that:
  + the box keeps its width;
  + the text's start shows at rest;
  + its end shows at the end of the scroll.
* A frame-budget check on the tower with 20 overflowing rows, in Chromium. It must not drop frames: compare against the tower with none overflowing, and report the numbers.

### Out of scope

* Fitting text by shrinking the font.
* Two-line wrapping.
* Changing the ticker.

### Process

Branch `BAJAOVRLAY-55-long-text-scrolls` off main, draft PR, the usual verify and 5× pinned run, screenshots of each changed graphic in the PR. The graphics packages only, so it can run alongside BAJAOVRLAY-53.

# Gate 2 (PR #36)

## Gate-2 review of PR #36: one fix-up round

An independent reviewer found the scroll engine sound:

* the cycle is a pure function with table tests;
* there is one clock per graphic;
* a resize to the same width is ignored;
* all 17 graphics are wired, and the ticker is untouched;
* the tokens are sensible;
* the race-clock split is clean.

Removing the stop in the tower's `stopAction`, or the rest-on-change, fails its test. The frame-budget test has teeth: the main-thread counters are asserted on every try, and only the dropped-frame count gets a best of 3.

### Fix

1. **Works on Chromium 103 (OBS 28–30) as well as newer, whatever João's OBS is.** Write the floor in the kit README.
   * `justify-content: safe …` needs Chromium 115. Below that it is dropped, and the bracket's right-side teams, the clock card's title and the countdown's session lose their alignment even when the text fits.
   * In `roundBoardStyles.ts:57`, `countdownStyles.ts` and `clockCardStyles.ts`, use an auto margin on the `.scrolling-text` child instead. An auto margin never pushes an overflowing child past the start edge.
   * Add `-webkit-mask-image` beside `mask-image` (`scrollingTextStyles.ts:256`), which needs Chromium 120.
   * If the renderer e2e can run a test with a Chromium-103-like engine, add it. If not, add a static test that the kit's and graphics' CSS uses none of the listed newer features, and say which.
2. **A graphic leaving keeps its texts where they are.** At stop-out, pause the scrolling animations, and cancel them once the play-out has finished; snapping to the start mid-exit is a visible jump. This changes the PR's decision. Update decisions.md, and keep the test that no cycle is left running after stop.
3. **Tests for what the code already does:**
   * A live update with the same names (the tower every 2 s, standings through `findTeamCellShowing`) does not restart a text's cycle.
   * A text that grows when its font loads, while nothing scrolls, starts at the next cycle.
   * Each must fail with its code reverted.
4. **ResizeObserver.** At each cycle start, unobserve boxes that are no longer connected (`scrollingTextWhenTooLong.ts:184-194`). The lower strip makes new pills every page, so over a 4-hour stint the observed targets pile up. Add a test.
5. **The small ones, one commit:**
   * test headers that still say "a GSAP timeline would go on running";
   * the orphaned doc comment at `race-clock.ts:68` and the overlong header line;
   * a unit test covering `animation.startTime = document.timeline.currentTime`;
   * commit the brief as `docs/briefs/BAJAOVRLAY-55.md`.

### For João

The scroll runs on Web Animations instead of GSAP. CLAUDE.md fixes GSAP ("do not substitute"), so this needs João's OK. If he gives it, the same PR adds one line to CLAUDE.md's stack: GSAP for animation, except scrolling text, which runs on Web Animations so the compositor moves it.

### Then

Run verify (flock, offset 800) and the 5× pinned run, push, and send fresh screenshots of the bracket, clock card and countdown.

## Item 1 changed (João, 2026-10-31)

The stream PC will run OBS 32 or later, so Chromium 103 is not a target. Item 1 shrinks to this:

* State the floor in the kit README: OBS 31+, the Chromium that version ships.
* Add `-webkit-mask-image` beside `mask-image`. It costs one line and keeps the fade in a slightly older OBS.
* Keep `justify-content: safe …` as written.
* No static CSS-feature test and no old-engine test.

Items 2–5 are unchanged.

/**
 * Long text scrolls inside its box: a change during a scroll (packages/graphics/kit)
 *
 * What this module is for:
 *   The clock of a graphic's scrolling texts (scrollingTextWhenTooLong.ts) runs one cycle
 *   for every text too long for its box. On air the texts change (a live update puts
 *   another car in a tower row) and boxes resize (a column switched off): such a text must
 *   go back to its start at once and wait for the next cycle, while the others go on.
 *
 * What these tests prove:
 *   - A text changed during a scroll has its animation cancelled at once (back at its start,
 *     no phase, no fade) and stays so for the rest of the cycle; the other texts' animations
 *     and phases are not disturbed.
 *   - It joins the next cycle with its new width.
 *   - A box resized during a scroll puts its text back at its start; a resize report with
 *     the same width (a browser sends one when a box is first watched) changes nothing.
 *   - A live update writing the same text (the tower's list every 2 s) does not restart it.
 *   - A text taken off the page during a scroll (a redraw that made its cell again) leaves
 *     the cycle at once: no animation goes on moving an element nobody sees.
 *   - A text that fit and grows past its box while nothing scrolls (its font has loaded)
 *     starts a cycle.
 *   - Boxes that left the page (the lower strip makes new pills every page) are no longer
 *     watched for resizes from the next cycle start, so watched boxes never pile up.
 *   - Each animation starts at the document timeline's time of now, so a box's phase
 *     timers and its text keep in step.
 *
 * What these tests deliberately do not cover:
 *   - Real layout, time and animations, as in scrollingTextWhenTooLong.test.ts: the widths
 *     are set by hand, the ResizeObserver is driven by the test, the timers run on fake
 *     time and the calls to `animate` are recorded.
 */
import { describe, expect, it } from 'vitest';

import { writeScrollingTextIfChanged } from './scrollingTextBox.js';
import {
  addTeamNameBox,
  createGraphicHostWithShadowRoot,
  installHandDrivenResizeObserver,
  letTheClockSeeTheChange,
  letTheCycleRunFor,
  readAnimationOf,
  startClockOverGraphic,
  takeControlOfTimeAndAnimations,
} from './scrollingTextClock.testSupport.js';
import { setTheDocumentTimeTo } from './webAnimationsInJsdom.testSupport.js';

/** The longest school of the field: 1236 px, 960 px to scroll in a 300 px box, 16 s. */
const utfprCornelioProcopio = 'UNIVERSIDADE TECNOLÓGICA FEDERAL DO PARANÁ - CORNÉLIO PROCÓPIO';

/** The longest name of all: 876 px, 600 px to scroll, 10 s. */
const iffItaperuna =
  'INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA FLUMINENSE - IFF - CAMPUS ITAPERUNA';

describe('a change during a scroll', () => {
  it('puts the changed text back at its start at once and lets the others go on', async () => {
    // Arrange: two rows scrolling, 4 s into the cycle.
    takeControlOfTimeAndAnimations();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const tucano = addTeamNameBox(root, 'EQUIPE TUCANO BAJA UFSC', {
      textWidthPx: 516,
      boxWidthPx: 300,
    });
    const iff = addTeamNameBox(root, iffItaperuna, { textWidthPx: 876, boxWidthPx: 300 });
    startClockOverGraphic(host, root);
    letTheCycleRunFor(4000);

    // Act: a live update puts another car in the first row; then the cycle goes on 1 s.
    tucano.widths.textWidthPx = 1236;
    writeScrollingTextIfChanged(tucano.box, utfprCornelioProcopio);
    await letTheClockSeeTheChange();
    const changedPhaseRightAway = tucano.box.dataset.scrollPhase;
    letTheCycleRunFor(1000);

    // Assert: the changed row is back at its start for the cycle; the other scrolls on.
    expect(readAnimationOf(tucano.text).isCancelled, 'its animation must be cancelled').toBe(true);
    expect(changedPhaseRightAway, 'its box must lose its phase at once').toBeUndefined();
    expect(tucano.box.dataset.scrollPhase, 'and keep none for this cycle').toBeUndefined();
    expect(readAnimationOf(iff.text).isCancelled, 'the other row must not be touched').toBe(false);
    expect(iff.box.dataset.scrollPhase, 'the other row must go on scrolling').toBe('scrolling');
  });

  it('lets the changed text join the next cycle with its new width', async () => {
    // Arrange: one row scrolling; its text changes 4 s in.
    takeControlOfTimeAndAnimations();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const tucano = addTeamNameBox(root, 'EQUIPE TUCANO BAJA UFSC', {
      textWidthPx: 516,
      boxWidthPx: 300,
    });
    startClockOverGraphic(host, root);
    letTheCycleRunFor(4000);
    tucano.widths.textWidthPx = 1236;
    writeScrollingTextIfChanged(tucano.box, utfprCornelioProcopio);
    await letTheClockSeeTheChange();

    // Act: the first cycle (2.5 s + 4 s + 1.5 s + 250 ms) runs to its end.
    letTheCycleRunFor(2500 + 4000 + 1500 + 250 - 4000);

    // Assert: a new cycle holds the new name, as long as its 960 px scroll needs.
    const animation = readAnimationOf(tucano.text);
    expect(animation.isCancelled, 'the new name must be animated in the next cycle').toBe(false);
    expect(animation.options.duration, 'the next cycle must be planned for the new name').toBe(
      2500 + 16_000 + 1500 + 250,
    );
    expect(tucano.box.dataset.scrollPhase, 'the new name holds at its start').toBe(
      'holdingAtStart',
    );
  });

  it('puts a text back at its start when its box is resized during a scroll', () => {
    // Arrange: a row scrolling 4 s into the cycle.
    takeControlOfTimeAndAnimations();
    const resizeObserver = installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const tucano = addTeamNameBox(root, 'EQUIPE TUCANO BAJA UFSC', {
      textWidthPx: 516,
      boxWidthPx: 300,
    });
    startClockOverGraphic(host, root);
    letTheCycleRunFor(4000);

    // Act: the operator turns a column off and the team cell grows to 400 px.
    tucano.widths.boxWidthPx = 400;
    resizeObserver.reportResizeOf(tucano.box);

    // Assert: the text is back at its start, without a phase, for the rest of the cycle.
    expect(readAnimationOf(tucano.text).isCancelled, 'its animation must be cancelled').toBe(true);
    expect(tucano.box.dataset.scrollPhase, 'its box must lose its phase').toBeUndefined();
  });

  it('keeps a scrolling text going when its box reports a resize to the same width', () => {
    // Arrange: a row scrolling 4 s into the cycle.
    takeControlOfTimeAndAnimations();
    const resizeObserver = installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const tucano = addTeamNameBox(root, 'EQUIPE TUCANO BAJA UFSC', {
      textWidthPx: 516,
      boxWidthPx: 300,
    });
    startClockOverGraphic(host, root);
    letTheCycleRunFor(4000);

    // Act: the browser reports the box (it does so once when first watched).
    resizeObserver.reportResizeOf(tucano.box);

    // Assert: nothing changed, so the text keeps its animation and its phase.
    expect(readAnimationOf(tucano.text).isCancelled, 'its animation must go on').toBe(false);
    expect(tucano.box.dataset.scrollPhase, 'the text must go on scrolling').toBe('scrolling');
  });
});

describe('a live update that writes the same text', () => {
  it('leaves the scrolling text going', async () => {
    // Arrange: a tower row 4 s into its scroll.
    takeControlOfTimeAndAnimations();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const iff = addTeamNameBox(root, iffItaperuna, { textWidthPx: 876, boxWidthPx: 300 });
    startClockOverGraphic(host, root);
    letTheCycleRunFor(4000);

    // Act: the positions arrive again (every 2 s) with the same name in the row.
    writeScrollingTextIfChanged(iff.box, iffItaperuna);
    await letTheClockSeeTheChange();

    // Assert: nothing was written, so the scroll goes on.
    expect(readAnimationOf(iff.text).isCancelled, 'the same name must not restart').toBe(false);
    expect(iff.box.dataset.scrollPhase, 'the text must go on scrolling').toBe('scrolling');
  });
});

describe('a text that grows past its box while nothing scrolls', () => {
  it('starts a cycle, as when the face loads after the first draw', () => {
    // Arrange: a name that fits in the fallback face, on air, so no cycle runs.
    takeControlOfTimeAndAnimations();
    const resizeObserver = installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const ufscar = addTeamNameBox(root, 'BAJA UFSCAR', { textWidthPx: 280, boxWidthPx: 300 });
    startClockOverGraphic(host, root);
    const cycleBeforeTheFace = ufscar.box.dataset.scrollPhase;

    // Act: the display face loads and the text grows past its box.
    ufscar.widths.textWidthPx = 320;
    resizeObserver.reportResizeOf(ufscar.text);

    // Assert: no cycle before; now the text holds at its start of a new cycle.
    expect(cycleBeforeTheFace, 'a fitting text runs no cycle').toBeUndefined();
    expect(readAnimationOf(ufscar.text).isCancelled, 'the grown text must be animated').toBe(false);
    expect(ufscar.box.dataset.scrollPhase, 'it holds at its start first').toBe('holdingAtStart');
  });
});

describe('boxes that left the page', () => {
  it('are no longer watched for resizes from the next cycle start', () => {
    // Arrange: a strip page of two pills, one too long, on air; the page turns and the
    // old pill leaves the page.
    takeControlOfTimeAndAnimations();
    const resizeObserver = installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const oldPill = addTeamNameBox(root, iffItaperuna, { textWidthPx: 876, boxWidthPx: 300 });
    const keptPill = addTeamNameBox(root, 'EQUIPE TUCANO BAJA UFSC', {
      textWidthPx: 516,
      boxWidthPx: 300,
    });
    startClockOverGraphic(host, root);
    const watchedWhileOnThePage = resizeObserver.listWatchedElements();
    oldPill.box.remove();

    // Act: the cycle runs to its end and the next one starts.
    letTheCycleRunFor(2500 + 10_000 + 1500 + 250);

    // Assert: the old pill's box and text are no longer watched; the kept pill still is.
    const watchedAfter = resizeObserver.listWatchedElements();
    expect(watchedWhileOnThePage, 'both pills are watched while on the page').toEqual(
      expect.arrayContaining([oldPill.box, oldPill.text, keptPill.box, keptPill.text]),
    );
    expect(watchedAfter, 'a box that left the page must no longer be watched').not.toEqual(
      expect.arrayContaining([oldPill.box]),
    );
    expect(watchedAfter, 'nor its text').not.toEqual(expect.arrayContaining([oldPill.text]));
    expect(watchedAfter, 'the pill still on the page stays watched').toEqual(
      expect.arrayContaining([keptPill.box, keptPill.text]),
    );
  });
});

describe('the start of each animation', () => {
  it("is the document timeline's time of now, not the next frame", () => {
    // Arrange: a page open for 12.5 s, a row too long.
    takeControlOfTimeAndAnimations();
    installHandDrivenResizeObserver();
    setTheDocumentTimeTo(12_500);
    const { host, root } = createGraphicHostWithShadowRoot();
    const iff = addTeamNameBox(root, iffItaperuna, { textWidthPx: 876, boxWidthPx: 300 });

    // Act: the graphic goes on air.
    startClockOverGraphic(host, root);

    // Assert: the animation started at 12.5 s, the moment its phase timers count from.
    expect(readAnimationOf(iff.text).startTime, 'the animation must start now').toBe(12_500);
  });
});

describe('a text taken off the page during a scroll', () => {
  it('leaves the cycle at once, its animation cancelled', async () => {
    // Arrange: two rows 4 s into their scroll.
    takeControlOfTimeAndAnimations();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const tucano = addTeamNameBox(root, 'EQUIPE TUCANO BAJA UFSC', {
      textWidthPx: 516,
      boxWidthPx: 300,
    });
    const iff = addTeamNameBox(root, iffItaperuna, { textWidthPx: 876, boxWidthPx: 300 });
    startClockOverGraphic(host, root);
    letTheCycleRunFor(4000);

    // Act: a redraw takes the first row's box off the page.
    tucano.box.remove();
    await letTheClockSeeTheChange();

    // Assert: its animation is cancelled; the row still on the page goes on.
    expect(readAnimationOf(tucano.text).isCancelled, 'the removed text must leave').toBe(true);
    expect(readAnimationOf(iff.text).isCancelled, 'the other row must go on').toBe(false);
  });
});

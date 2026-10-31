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
 *
 * What these tests deliberately do not cover:
 *   - Real layout, time and animations, as in scrollingTextWhenTooLong.test.ts: the widths
 *     are set by hand, the ResizeObserver is driven by the test, the timers run on fake
 *     time and the calls to `animate` are recorded.
 */
import { describe, expect, it } from 'vitest';

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
import { writeScrollingTextIfChanged } from './scrollingTextWhenTooLong.js';

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

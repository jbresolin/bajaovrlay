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
 *   - A text changed during a scroll is back at its start at once, stays there for the
 *     rest of the cycle, and the other texts are not disturbed.
 *   - It joins the next cycle with its new width.
 *   - A box resized during a scroll puts its text back at its start; a resize report with
 *     the same width (a browser sends one when a box is first watched) changes nothing.
 *
 * What these tests deliberately do not cover:
 *   - Real layout and real time, as in scrollingTextWhenTooLong.test.ts: the widths are set
 *     by hand, the ResizeObserver is driven by the test, the timeline is moved by `seek`.
 */
import { describe, expect, it } from 'vitest';

import { finishEveryRunningMotionAtOnce } from './runningMotions.testSupport.js';
import {
  addTeamNameBox,
  createGraphicHostWithShadowRoot,
  endLeftoverTimelinesWhenTheTestEnds,
  installHandDrivenResizeObserver,
  letTheClockSeeTheChange,
  moveTimelineTo,
  pauseTheOneCycleTimeline,
  readTextOffsetPx,
  startClockOverGraphic,
} from './scrollingTextClock.testSupport.js';
import { writeScrollingTextIfChanged } from './scrollingTextWhenTooLong.js';

describe('a change during a scroll', () => {
  it('puts the changed text back at its start at once and lets the others go on', async () => {
    // Arrange: two rows scrolling, 4 s into the cycle.
    endLeftoverTimelinesWhenTheTestEnds();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const tucano = addTeamNameBox(root, 'EQUIPE TUCANO BAJA UFSC', {
      textWidthPx: 516,
      boxWidthPx: 300,
    });
    const iff = addTeamNameBox(
      root,
      'INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA FLUMINENSE - IFF - CAMPUS ITAPERUNA',
      { textWidthPx: 876, boxWidthPx: 300 },
    );
    startClockOverGraphic(host, root);
    const timeline = pauseTheOneCycleTimeline();
    moveTimelineTo(timeline, 4000);

    // Act: a live update puts another car in the first row; then the cycle goes on 1 s.
    tucano.widths.textWidthPx = 1236;
    writeScrollingTextIfChanged(
      tucano.box,
      'UNIVERSIDADE TECNOLÓGICA FEDERAL DO PARANÁ - CORNÉLIO PROCÓPIO',
    );
    await letTheClockSeeTheChange();
    const changedOffsetRightAway = readTextOffsetPx(tucano.text);
    moveTimelineTo(timeline, 5000);

    // Assert: the changed row rests at its start through the cycle; the other scrolls on.
    expect(changedOffsetRightAway, 'the changed text must be back at its start at once').toBe(0);
    expect(readTextOffsetPx(tucano.text), 'it must stay at its start for this cycle').toBe(0);
    expect(tucano.box.dataset.scrollPhase, 'its box must lose its phase and its fade').toBe(
      undefined,
    );
    expect(readTextOffsetPx(iff.text), 'the other row must be 2.5 s along at 60 px/s').toBeCloseTo(
      -150,
      3,
    );
  });

  it('lets the changed text join the next cycle with its new width', async () => {
    // Arrange: one row scrolling; its text changes 4 s in.
    endLeftoverTimelinesWhenTheTestEnds();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const tucano = addTeamNameBox(root, 'EQUIPE TUCANO BAJA UFSC', {
      textWidthPx: 516,
      boxWidthPx: 300,
    });
    startClockOverGraphic(host, root);
    const firstCycle = pauseTheOneCycleTimeline();
    moveTimelineTo(firstCycle, 4000);
    tucano.widths.textWidthPx = 1236;
    writeScrollingTextIfChanged(
      tucano.box,
      'UNIVERSIDADE TECNOLÓGICA FEDERAL DO PARANÁ - CORNÉLIO PROCÓPIO',
    );
    await letTheClockSeeTheChange();

    // Act: the first cycle ends.
    firstCycle.resume();
    finishEveryRunningMotionAtOnce();

    // Assert: a new cycle holds the new name, as long as its 960 px scroll needs.
    const nextCycle = pauseTheOneCycleTimeline();
    expect(nextCycle, 'the next cycle must be a new timeline').not.toBe(firstCycle);
    expect(nextCycle.duration(), 'the next cycle must be planned for the new name').toBeCloseTo(
      (2500 + 16_000 + 1500 + 250) / 1000,
      3,
    );
    expect(tucano.box.dataset.scrollPhase, 'the new name holds at its start').toBe(
      'holdingAtStart',
    );
  });

  it('puts a text back at its start when its box is resized during a scroll', () => {
    // Arrange: a row scrolling 4 s into the cycle.
    endLeftoverTimelinesWhenTheTestEnds();
    const resizeObserver = installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const tucano = addTeamNameBox(root, 'EQUIPE TUCANO BAJA UFSC', {
      textWidthPx: 516,
      boxWidthPx: 300,
    });
    startClockOverGraphic(host, root);
    const timeline = pauseTheOneCycleTimeline();
    moveTimelineTo(timeline, 4000);

    // Act: the operator turns a column off and the team cell grows to 400 px.
    tucano.widths.boxWidthPx = 400;
    resizeObserver.reportResizeOf(tucano.box);

    // Assert: the text is back at its start, without a phase, for the rest of the cycle.
    expect(readTextOffsetPx(tucano.text), 'the resized text must be back at its start').toBe(0);
    expect(tucano.box.dataset.scrollPhase, 'its box must lose its phase').toBeUndefined();
  });

  it('keeps a scrolling text going when its box reports a resize to the same width', () => {
    // Arrange: a row scrolling 4 s into the cycle.
    endLeftoverTimelinesWhenTheTestEnds();
    const resizeObserver = installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const tucano = addTeamNameBox(root, 'EQUIPE TUCANO BAJA UFSC', {
      textWidthPx: 516,
      boxWidthPx: 300,
    });
    startClockOverGraphic(host, root);
    const timeline = pauseTheOneCycleTimeline();
    moveTimelineTo(timeline, 4000);

    // Act: the browser reports the box (it does so once when first watched).
    resizeObserver.reportResizeOf(tucano.box);

    // Assert: nothing changed, so the text keeps its place in the scroll.
    expect(tucano.box.dataset.scrollPhase, 'the text must go on scrolling').toBe('scrolling');
    expect(readTextOffsetPx(tucano.text), 'it must be 1.5 s along').toBeCloseTo(-90, 3);
  });
});

describe('a text that becomes too long while nothing scrolls', () => {
  it('starts a cycle', async () => {
    // Arrange: a tower whose names all fit, on air.
    endLeftoverTimelinesWhenTheTestEnds();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const row = addTeamNameBox(root, 'BAJA UFPR', { textWidthPx: 180, boxWidthPx: 300 });
    startClockOverGraphic(host, root);

    // Act: a live update writes a long school into the row.
    row.widths.textWidthPx = 876;
    writeScrollingTextIfChanged(
      row.box,
      'INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA FLUMINENSE - IFF - CAMPUS ITAPERUNA',
    );
    await letTheClockSeeTheChange();

    // Assert: a cycle runs, the new text holding at its start first.
    pauseTheOneCycleTimeline();
    expect(row.box.dataset.scrollPhase, 'the new long text must hold at its start').toBe(
      'holdingAtStart',
    );
  });
});

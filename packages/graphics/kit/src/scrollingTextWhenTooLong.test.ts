/**
 * Long text scrolls inside its box, one clock per graphic (packages/graphics/kit)
 *
 * What this module is for:
 *   Every text on air that can be too long for its box (a team, a school, a person, a
 *   session, the event line) sits in a clipped box and scrolls instead of being cut with an
 *   ellipsis. A graphic makes one clock over its shadow root and starts it on air: at each
 *   cycle start the clock measures every box, plans the cycle (scrollingTextCycle.ts) and
 *   runs it as one GSAP timeline, so all the texts of the graphic move together. A text
 *   that changes, or whose box resizes, during a cycle goes back to its start and joins at
 *   the next cycle start.
 *
 * What these tests prove:
 *   - Texts that fit run no cycle at all; nothing moves.
 *   - A text too long holds at its start, then the timeline moves it exactly where the
 *     pure cycle says, its box naming the phase (`data-scroll-phase`).
 *   - The texts of one graphic run in one timeline, and each cycle measures them again.
 *   - (A change during a scroll, and a resize: scrollingTextWhenTooLong.changes.test.ts.)
 *   - A text that becomes too long while nothing scrolls starts a cycle.
 *   - Stop ends the cycle (a test that fails without the stop), puts every text back at its
 *     start without its fade, and nothing starts again after it.
 *
 * What these tests deliberately do not cover:
 *   - Real layout: jsdom measures every element at 0 px, so each test gives its boxes and
 *     texts their widths by hand, and hands the clock a ResizeObserver it drives itself.
 *     The Playwright tests of the tower, the standings, the lower third, the team card and
 *     the bracket measure the real thing in Chromium.
 *   - Real time: no test waits for GSAP. The cycle's timeline is paused as soon as it
 *     starts and moved by hand (`seek`), or ended at once with the kit's finish helper.
 *   - The look of the fade; the screenshots of each graphic.
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import { finishEveryRunningMotionAtOnce } from './runningMotions.testSupport.js';
import {
  addTeamNameBox,
  ardosiaTextTimings,
  createGraphicHostWithShadowRoot,
  endLeftoverTimelinesWhenTheTestEnds,
  findRunningCycleTimelines,
  installHandDrivenResizeObserver,
  letTheClockSeeTheChange,
  moveTimelineTo,
  pauseTheOneCycleTimeline,
  readTextOffsetPx,
  startClockOverGraphic,
} from './scrollingTextClock.testSupport.js';
import { readScrollingTextPhaseAt } from './scrollingTextCycle.js';
import { makeScrollingTextBox, writeScrollingTextIfChanged } from './scrollingTextWhenTooLong.js';

describe('texts that fit their boxes', () => {
  it('run no cycle and never move', () => {
    // Arrange: two tower rows whose names fit their 300 px boxes.
    endLeftoverTimelinesWhenTheTestEnds();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const ufpr = addTeamNameBox(root, 'BAJA UFPR', { textWidthPx: 180, boxWidthPx: 300 });
    const unesp = addTeamNameBox(root, 'BAJA UNESP', { textWidthPx: 196, boxWidthPx: 300 });

    // Act: the graphic goes on air.
    startClockOverGraphic(host, root);

    // Assert: no timeline, no phase on either box, nothing moved.
    expect(findRunningCycleTimelines(), 'texts that fit must run no cycle').toEqual([]);
    for (const { box, text } of [ufpr, unesp]) {
      expect(box.dataset.scrollPhase, 'a fitting box must name no phase').toBeUndefined();
      expect(readTextOffsetPx(text), 'a fitting text must never move').toBe(0);
    }
  });
});

describe('a text too long for its box', () => {
  it('holds at its start, then moves exactly where the pure cycle says', () => {
    // Arrange: the longest school in the field, 1236 px in a 300 px box.
    endLeftoverTimelinesWhenTheTestEnds();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const utfpr = addTeamNameBox(
      root,
      'UNIVERSIDADE TECNOLÓGICA FEDERAL DO PARANÁ - CORNÉLIO PROCÓPIO',
      { textWidthPx: 1236, boxWidthPx: 300 },
    );

    // Act: go on air and stop the cycle's timeline so the test moves it.
    startClockOverGraphic(host, root);
    const timeline = pauseTheOneCycleTimeline();
    const phaseRightAway = utfpr.box.dataset.scrollPhase;
    const offsetRightAway = readTextOffsetPx(utfpr.text);
    moveTimelineTo(timeline, 2500 + 4000);

    // Assert: at its start first, then 240 px along after 4 s of scroll, like the pure cycle.
    expect(phaseRightAway, 'the box must hold at its start first').toBe('holdingAtStart');
    expect(offsetRightAway, 'the text must start at its start').toBe(0);
    const expected = readScrollingTextPhaseAt(
      {
        durationMs: 2500 + 16_000 + 1500 + 250,
        scrollDistancePxByName: new Map([['the school', 960]]),
      },
      'the school',
      2500 + 4000,
      ardosiaTextTimings,
    );
    expect(utfpr.box.dataset.scrollPhase, 'the box must say it is scrolling').toBe('scrolling');
    expect(readTextOffsetPx(utfpr.text), 'the text must be where the pure cycle puts it').toBeCloseTo(
      expected.offsetPx,
      3,
    );
  });

  it('holds at its end with its last letter clear of the fade, then crossfades back', () => {
    // Arrange: a team name 36 px too long: 60 px to scroll, 1 s at 60 px/s.
    endLeftoverTimelinesWhenTheTestEnds();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const mangue = addTeamNameBox(root, 'EQUIPE MANGUE BAJA UFPE', {
      textWidthPx: 336,
      boxWidthPx: 300,
    });
    startClockOverGraphic(host, root);
    const timeline = pauseTheOneCycleTimeline();

    // Act: move to the end hold, then into the second half of the return.
    moveTimelineTo(timeline, 2500 + 1000 + 500);
    const phaseAtTheEnd = mangue.box.dataset.scrollPhase;
    const offsetAtTheEnd = readTextOffsetPx(mangue.text);
    moveTimelineTo(timeline, 2500 + 1000 + 1500 + 125 + 62.5);

    // Assert: 60 px along at the end; back at its start, half faded in, in the return.
    expect(phaseAtTheEnd, 'the box must hold at its end').toBe('holdingAtEnd');
    expect(offsetAtTheEnd, 'the text must have scrolled its overflow plus the fade').toBeCloseTo(
      -60,
      3,
    );
    expect(mangue.box.dataset.scrollPhase, 'the box must be fading the start in').toBe(
      'fadingInAtStart',
    );
    expect(readTextOffsetPx(mangue.text), 'the text must be back at its start').toBe(0);
    expect(Number(gsap.getProperty(mangue.text, 'opacity')), 'half faded in').toBeCloseTo(0.5, 3);
  });
});

describe('one clock per graphic', () => {
  it('runs the texts of the graphic in one timeline, starting and ending together', () => {
    // Arrange: three rows too long by different amounts, one row that fits.
    endLeftoverTimelinesWhenTheTestEnds();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const mangue = addTeamNameBox(root, 'EQUIPE MANGUE BAJA UFPE', {
      textWidthPx: 336,
      boxWidthPx: 300,
    });
    const tucano = addTeamNameBox(root, 'EQUIPE TUCANO BAJA UFSC', {
      textWidthPx: 516,
      boxWidthPx: 300,
    });
    const iff = addTeamNameBox(
      root,
      'INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA FLUMINENSE - IFF - CAMPUS ITAPERUNA',
      { textWidthPx: 876, boxWidthPx: 300 },
    );
    addTeamNameBox(root, 'BAJA UFPR', { textWidthPx: 180, boxWidthPx: 300 });

    // Act: go on air and read the cycle 5 s in and just before the return.
    startClockOverGraphic(host, root);
    const timeline = pauseTheOneCycleTimeline();
    moveTimelineTo(timeline, 5000);
    const phasesAtFiveSeconds = [mangue, tucano, iff].map(({ box }) => box.dataset.scrollPhase);
    moveTimelineTo(timeline, 2500 + 10_000 + 1500 - 1);
    const phasesBeforeTheReturn = [mangue, tucano, iff].map(({ box }) => box.dataset.scrollPhase);

    // Assert: one timeline as long as the longest needs; the shortest waits at its end.
    expect(timeline.duration(), 'the cycle must last as the longest text needs').toBeCloseTo(
      (2500 + 10_000 + 1500 + 250) / 1000,
      3,
    );
    expect(phasesAtFiveSeconds, 'the short one waits at its end while the others scroll').toEqual([
      'holdingAtEnd',
      'scrolling',
      'scrolling',
    ]);
    expect(phasesBeforeTheReturn, 'all three must be at their end before the return').toEqual([
      'holdingAtEnd',
      'holdingAtEnd',
      'holdingAtEnd',
    ]);
  });

  it('measures every text again at the start of the next cycle', () => {
    // Arrange: one name too long; before the cycle ends the tower's column grows wider.
    endLeftoverTimelinesWhenTheTestEnds();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const tucano = addTeamNameBox(root, 'EQUIPE TUCANO BAJA UFSC', {
      textWidthPx: 516,
      boxWidthPx: 300,
    });
    startClockOverGraphic(host, root);
    const firstCycle = pauseTheOneCycleTimeline();
    tucano.widths.boxWidthPx = 600;

    // Act: the first cycle reaches its end (the kit's finish helper, no real time).
    firstCycle.resume();
    finishEveryRunningMotionAtOnce();

    // Assert: the next cycle measured the wider box: the name fits, so no cycle runs.
    expect(findRunningCycleTimelines(), 'a name that now fits must not start a cycle').toEqual([]);
    expect(readTextOffsetPx(tucano.text), 'the name must rest at its start').toBe(0);
    expect(tucano.box.dataset.scrollPhase, 'the box must name no phase').toBeUndefined();
  });
});

describe('stop', () => {
  it('ends the cycle and puts every text back at its start without its fade', () => {
    // Arrange: two rows 4 s into a cycle.
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
    const clock = startClockOverGraphic(host, root);
    const timeline = pauseTheOneCycleTimeline();
    moveTimelineTo(timeline, 4000);
    timeline.resume();

    // Act: the graphic is taken off air.
    clock.stop();

    // Assert: no timeline is left running, and both texts rest at their start.
    expect(findRunningCycleTimelines(), 'stop must end the cycle: nothing left running').toEqual([]);
    for (const { box, text } of [tucano, iff]) {
      expect(readTextOffsetPx(text), 'every text must be back at its start').toBe(0);
      expect(Number(gsap.getProperty(text, 'opacity')), 'every text fully shown').toBe(1);
      expect(box.dataset.scrollPhase, 'no box keeps a phase, so none keeps its fade').toBe(
        undefined,
      );
    }
  });

  it('starts nothing when a text changes after the stop', async () => {
    // Arrange: a tower that went on air and off again.
    endLeftoverTimelinesWhenTheTestEnds();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const row = addTeamNameBox(root, 'BAJA UFPR', { textWidthPx: 180, boxWidthPx: 300 });
    const clock = startClockOverGraphic(host, root);
    clock.stop();

    // Act: an update off air writes a long school into the row.
    row.widths.textWidthPx = 876;
    writeScrollingTextIfChanged(
      row.box,
      'INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA FLUMINENSE - IFF - CAMPUS ITAPERUNA',
    );
    await letTheClockSeeTheChange();

    // Assert: off air nothing moves.
    expect(findRunningCycleTimelines(), 'a stopped clock must start no cycle').toEqual([]);
  });
});

describe('writeScrollingTextIfChanged', () => {
  it('writes the text inside the box, so the box reads as the text alone', () => {
    // Arrange: a lower third's name box.
    const box = document.createElement('div');
    makeScrollingTextBox(box);

    // Act: write a person's name into it.
    writeScrollingTextIfChanged(box, 'MARIA EDUARDA DOS SANTOS');

    // Assert: the box's text is the name, held by the one text element inside.
    expect(box.textContent, 'the box must read as the name').toBe('MARIA EDUARDA DOS SANTOS');
    expect(box.classList.contains('scrolling-text-box'), 'the box must be marked').toBe(true);
    expect(box.children.length, 'the box must hold the one text element').toBe(1);
  });
});

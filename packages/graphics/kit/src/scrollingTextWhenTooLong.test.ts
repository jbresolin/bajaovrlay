/**
 * Long text scrolls inside its box, one clock per graphic (packages/graphics/kit)
 *
 * What this module is for:
 *   Every text on air that can be too long for its box (a team, a school, a person, a
 *   session, the event line) sits in a clipped box and scrolls instead of being cut with an
 *   ellipsis. A graphic makes one clock over its shadow root and starts it on air: at each
 *   cycle start the clock measures every box, plans the cycle (scrollingTextCycle.ts) and
 *   starts one Web Animation per text too long, all together, with one timer for the next
 *   cycle. A text that changes, or whose box resizes, during a cycle goes back to its start
 *   and joins at the next cycle start (scrollingTextWhenTooLong.changes.test.ts).
 *
 * What these tests prove:
 *   - Texts that fit get no animation; nothing moves.
 *   - A text too long gets one animation over the whole cycle, with the keyframes the pure
 *     cycle gives (transform and opacity only), and its box names each phase in turn
 *     (`data-scroll-phase`), holding at its start first.
 *   - The texts of one graphic share one cycle: one id, one length, the longest's.
 *   - When a cycle ends, the next one measures every text again.
 *   - A text that becomes too long while nothing scrolls starts a cycle.
 *   - Stop cancels every animation and every timer (a test that fails without the stop),
 *     takes every phase off, and nothing starts again after it.
 *
 * What these tests deliberately do not cover:
 *   - Real layout: jsdom measures every element at 0 px, so each test gives its boxes and
 *     texts their widths by hand. The Playwright tests of the tower, the standings, the
 *     lower third, the team card and the bracket measure the real thing in Chromium.
 *   - Real time and real animations: jsdom has no Web Animations, so the calls to
 *     `animate` are recorded, and the clock's timers run on fake time. Where the keyframes
 *     put a text at each moment is scrollingTextKeyframes.test.ts's to prove.
 *   - The look of the fade; the screenshots of each graphic.
 */
import { describe, expect, it, vi } from 'vitest';

import { makeScrollingTextBox, writeScrollingTextIfChanged } from './scrollingTextBox.js';
import {
  addTeamNameBox,
  ardosiaTextTimings,
  createGraphicHostWithShadowRoot,
  installHandDrivenResizeObserver,
  letTheClockSeeTheChange,
  letTheCycleRunFor,
  readAnimationOf,
  startClockOverGraphic,
  takeControlOfTimeAndAnimations,
} from './scrollingTextClock.testSupport.js';
import { planScrollingTextCycle } from './scrollingTextCycle.js';
import { buildScrollingTextKeyframes } from './scrollingTextKeyframes.js';
import { findRunningScrollingTextCycles } from './scrollingTextOnAir.testSupport.js';
import { listUncancelledAnimations } from './webAnimationsInJsdom.testSupport.js';

/** The longest school of the field, 1236 px in a 300 px box: 960 px to scroll, 16 s. */
const utfprCornelioProcopio = 'UNIVERSIDADE TECNOLÓGICA FEDERAL DO PARANÁ - CORNÉLIO PROCÓPIO';

/** The longest name of all: 876 px in a 300 px box, 600 px to scroll, 10 s. */
const iffItaperuna =
  'INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA FLUMINENSE - IFF - CAMPUS ITAPERUNA';

describe('texts that fit their boxes', () => {
  it('get no animation and never move', () => {
    // Arrange: two tower rows whose names fit their 300 px boxes.
    takeControlOfTimeAndAnimations();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const ufpr = addTeamNameBox(root, 'BAJA UFPR', { textWidthPx: 180, boxWidthPx: 300 });
    const unesp = addTeamNameBox(root, 'BAJA UNESP', { textWidthPx: 196, boxWidthPx: 300 });

    // Act: the graphic goes on air.
    startClockOverGraphic(host, root);

    // Assert: no animation at all, no phase on either box.
    expect(listUncancelledAnimations(), 'texts that fit must not be animated').toEqual([]);
    for (const { box } of [ufpr, unesp]) {
      expect(box.dataset.scrollPhase, 'a fitting box must name no phase').toBeUndefined();
    }
  });
});

describe('a text too long for its box', () => {
  it('gets one animation over the cycle, with the keyframes of the pure cycle', () => {
    // Arrange: the longest school in the field in a tower row.
    takeControlOfTimeAndAnimations();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const utfpr = addTeamNameBox(root, utfprCornelioProcopio, {
      textWidthPx: 1236,
      boxWidthPx: 300,
    });

    // Act: the graphic goes on air.
    startClockOverGraphic(host, root);

    // Assert: one animation of the text, as long as the cycle, with the cycle's keyframes.
    const expectedCycle = planScrollingTextCycle(
      new Map([['the school', { textWidthPx: 1236, boxWidthPx: 300 }]]),
      ardosiaTextTimings,
    );
    const animation = readAnimationOf(utfpr.text);
    expect(animation.options.duration, 'the animation must last the whole cycle').toBe(
      2500 + 16_000 + 1500 + 250,
    );
    expect(animation.options.easing, 'the keyframes must be read linearly').toBe('linear');
    expect(animation.keyframes, "the keyframes must be the pure cycle's").toEqual(
      buildScrollingTextKeyframes(expectedCycle, 'the school', ardosiaTextTimings),
    );
  });

  it('names each phase on its box in turn, holding at its start first', () => {
    // Arrange: a team name 36 px too long: 60 px to scroll, 1 s at 60 px/s.
    takeControlOfTimeAndAnimations();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const mangue = addTeamNameBox(root, 'EQUIPE MANGUE BAJA UFPE', {
      textWidthPx: 336,
      boxWidthPx: 300,
    });

    // Act: go on air and read the box's phase at each step of the cycle.
    startClockOverGraphic(host, root);
    const phases = [mangue.box.dataset.scrollPhase];
    for (const stepMs of [2500, 1000, 1500, 125]) {
      letTheCycleRunFor(stepMs);
      phases.push(mangue.box.dataset.scrollPhase);
    }

    // Assert: hold, scroll, hold at the end, fade out, fade in.
    expect(phases, 'the box must name the phases of the cycle in order').toEqual([
      'holdingAtStart',
      'scrolling',
      'holdingAtEnd',
      'fadingOutAtEnd',
      'fadingInAtStart',
    ]);
  });
});

describe('one clock per graphic', () => {
  it('starts the texts of the graphic together, in one cycle as long as the longest needs', () => {
    // Arrange: three rows too long by different amounts, one row that fits.
    takeControlOfTimeAndAnimations();
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
    const iff = addTeamNameBox(root, iffItaperuna, { textWidthPx: 876, boxWidthPx: 300 });
    addTeamNameBox(root, 'BAJA UFPR', { textWidthPx: 180, boxWidthPx: 300 });

    // Act: go on air, and read the phases 5 s in and just before the return.
    startClockOverGraphic(host, root);
    const animations = [mangue, tucano, iff].map(({ text }) => readAnimationOf(text));
    letTheCycleRunFor(5000);
    const phasesAtFiveSeconds = [mangue, tucano, iff].map(({ box }) => box.dataset.scrollPhase);
    letTheCycleRunFor(2500 + 10_000 + 1500 - 1 - 5000);
    const phasesBeforeTheReturn = [mangue, tucano, iff].map(({ box }) => box.dataset.scrollPhase);

    // Assert: one cycle (one id, one length: the longest's); the shortest waits at its end.
    expect(findRunningScrollingTextCycles(), 'the graphic must run one cycle').toHaveLength(1);
    const durations = new Set(animations.map((animation) => animation.options.duration));
    expect([...durations], 'every animation must last the one cycle').toEqual([
      2500 + 10_000 + 1500 + 250,
    ]);
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
    takeControlOfTimeAndAnimations();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const tucano = addTeamNameBox(root, 'EQUIPE TUCANO BAJA UFSC', {
      textWidthPx: 516,
      boxWidthPx: 300,
    });
    startClockOverGraphic(host, root);
    tucano.widths.boxWidthPx = 600;

    // Act: the first cycle runs to its end.
    letTheCycleRunFor(2500 + 4000 + 1500 + 250);

    // Assert: the next cycle measured the wider box: the name fits, so nothing runs.
    expect(findRunningScrollingTextCycles(), 'a name that now fits must not run').toEqual([]);
    expect(tucano.box.dataset.scrollPhase, 'the box must name no phase').toBeUndefined();
  });

  it('starts the next cycle with new animations when one ends', () => {
    // Arrange: one name too long, on air.
    takeControlOfTimeAndAnimations();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const tucano = addTeamNameBox(root, 'EQUIPE TUCANO BAJA UFSC', {
      textWidthPx: 516,
      boxWidthPx: 300,
    });
    startClockOverGraphic(host, root);
    const firstAnimation = readAnimationOf(tucano.text);

    // Act: the first cycle runs to its end.
    letTheCycleRunFor(2500 + 4000 + 1500 + 250);

    // Assert: the first animation is cancelled, a new one runs, holding at its start.
    const secondAnimation = readAnimationOf(tucano.text);
    expect(firstAnimation.isCancelled, "the ended cycle's animation must be cancelled").toBe(true);
    expect(secondAnimation, 'a new cycle must start a new animation').not.toBe(firstAnimation);
    expect(secondAnimation.id, 'the new cycle must have its own id').not.toBe(firstAnimation.id);
    expect(tucano.box.dataset.scrollPhase, 'the text holds at its start again').toBe(
      'holdingAtStart',
    );
  });
});

describe('a text that becomes too long while nothing scrolls', () => {
  it('starts a cycle', async () => {
    // Arrange: a tower whose names all fit, on air.
    takeControlOfTimeAndAnimations();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const row = addTeamNameBox(root, 'BAJA UFPR', { textWidthPx: 180, boxWidthPx: 300 });
    startClockOverGraphic(host, root);

    // Act: a live update writes a long school into the row.
    row.widths.textWidthPx = 876;
    writeScrollingTextIfChanged(row.box, iffItaperuna);
    await letTheClockSeeTheChange();

    // Assert: a cycle runs, the new text holding at its start first.
    expect(findRunningScrollingTextCycles(), 'the new long text must start a cycle').toHaveLength(
      1,
    );
    expect(row.box.dataset.scrollPhase, 'the new long text must hold at its start').toBe(
      'holdingAtStart',
    );
  });
});

describe('stop', () => {
  it('cancels every animation and timer, and takes every phase off', () => {
    // Arrange: two rows 4 s into a cycle.
    takeControlOfTimeAndAnimations();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const tucano = addTeamNameBox(root, 'EQUIPE TUCANO BAJA UFSC', {
      textWidthPx: 516,
      boxWidthPx: 300,
    });
    const iff = addTeamNameBox(root, iffItaperuna, { textWidthPx: 876, boxWidthPx: 300 });
    const clock = startClockOverGraphic(host, root);
    letTheCycleRunFor(4000);

    // Act: the graphic is taken off air; later, a long while passes.
    clock.stop();
    const cyclesRightAfterTheStop = findRunningScrollingTextCycles();
    const timersRightAfterTheStop = vi.getTimerCount();
    letTheCycleRunFor(60_000);

    // Assert: at once nothing runs and no timer is left; nothing started again since; no
    // box keeps a phase (or its fade).
    expect(cyclesRightAfterTheStop, 'stop must end the cycle at once').toEqual([]);
    expect(timersRightAfterTheStop, 'stop must clear every timer of the cycle').toBe(0);
    expect(listUncancelledAnimations(), 'no animation may start after the stop').toEqual([]);
    for (const { box } of [tucano, iff]) {
      expect(box.dataset.scrollPhase, 'no box keeps a phase, so none keeps its fade').toBe(
        undefined,
      );
    }
  });

  it('starts nothing when a text changes after the stop', async () => {
    // Arrange: a tower that went on air and off again.
    takeControlOfTimeAndAnimations();
    installHandDrivenResizeObserver();
    const { host, root } = createGraphicHostWithShadowRoot();
    const row = addTeamNameBox(root, 'BAJA UFPR', { textWidthPx: 180, boxWidthPx: 300 });
    const clock = startClockOverGraphic(host, root);
    clock.stop();

    // Act: an update off air writes a long school into the row.
    row.widths.textWidthPx = 876;
    writeScrollingTextIfChanged(row.box, iffItaperuna);
    await letTheClockSeeTheChange();

    // Assert: off air nothing moves.
    expect(findRunningScrollingTextCycles(), 'a stopped clock must start no cycle').toEqual([]);
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

describe('makeScrollingTextBox', () => {
  it("wraps what the box holds, so a team's name and its school scroll as one line", () => {
    // Arrange: a tower row's team cell holding the team name and its school.
    const cell = document.createElement('span');
    const teamName = document.createElement('span');
    teamName.textContent = 'BAJA UTFPR';
    const schoolName = document.createElement('span');
    schoolName.textContent = 'UNIVERSIDADE TECNOLÓGICA FEDERAL DO PARANÁ - CORNÉLIO PROCÓPIO';
    cell.append(teamName, schoolName);

    // Act: make the cell a scrolling box.
    const text = makeScrollingTextBox(cell);

    // Assert: the one text element holds both, in order, and is the cell's only child.
    expect(cell.children.length, 'the cell must hold the one text element').toBe(1);
    expect([...text.children], 'the name and the school must move together').toEqual([
      teamName,
      schoolName,
    ]);
  });

  it('answers the same text element when called again', () => {
    // Arrange: a box already made scrolling.
    const box = document.createElement('span');
    const firstText = makeScrollingTextBox(box);

    // Act: make it scrolling again, as a column rebuild would.
    const secondText = makeScrollingTextBox(box);

    // Assert: nothing is wrapped twice.
    expect(secondText, 'a box must keep its one text element').toBe(firstText);
    expect(box.children.length, 'a box must never hold two text elements').toBe(1);
  });
});

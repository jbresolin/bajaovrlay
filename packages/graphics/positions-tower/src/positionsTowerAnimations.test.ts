/**
 * Positions tower animations (packages/graphics/positions-tower)
 *
 * What this module is for:
 *   The tower's head rises in first and its rows cascade after it on play, everything
 *   lifts out together on stop, a page turns (the rows out together, the new rows in
 *   cascade), an update slides the rows whose slot changed (FLIP) while cars rise in
 *   and lift out, and the cues are held then cleared. The GSAP timelines live here and
 *   take every duration, offset and ease from the theme's motion tokens (`--motion-*`,
 *   `--ease-*`), read from the page through `@bajaovrlay/theme/motion`.
 *
 * What these tests prove:
 *   - Each timeline lasts exactly what its tokens say: the play-in `--motion-in` plus one
 *     `--motion-row-stagger` per row (1000 ms with 20 rows, what the manifest promises),
 *     the stop-out `--motion-out`, a page's rows-in `--motion-in` plus one stagger per row
 *     after the first, an update the longest of its slides, rises and lifts, the cue hold
 *     `--motion-cue-hold`.
 *   - On a page without the theme every timeline lasts 0 (no motion, as the theme
 *     package promises for a missing token), so every action still ends.
 *   - A FLIP slide starts from the measured shift and ends at 0, so a row is drawn
 *     where it was and slides to where it is.
 *   - The cue hold calls the clear once its hold has passed, not before.
 *   - With skipAnimation, a timeline jumps straight to its end and the promise
 *     resolves at once; a timeline that reached its end is killed, so GSAP holds no
 *     finished timelines during a whole day on air inside OBS.
 *
 * What these tests deliberately do not cover:
 *   - What the animations look like; the Playwright tests watch them in Chromium.
 *   - Reading and parsing the tokens; packages/theme tests readMotionTokens.
 */
import { gsap } from 'gsap';
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  buildCueHoldTimeline,
  buildPlayInTimeline,
  buildRowsInTimeline,
  buildRowsOutTimeline,
  buildStopOutTimeline,
  buildUpdateTimeline,
  playTimelineToTheEnd,
} from './positionsTowerAnimations.js';
import {
  ardosiaMotionTokenDeclarations,
  placeTokensOnTheRoot,
} from './positionsTowerOnThePage.testSupport.js';

/** Builds a tower stand-in on the page: the tower, its head and `rowCount` rows. */
function createTowerPiecesInAnEmptyPage(rowCount: number) {
  const tower = document.createElement('section');
  const head = document.createElement('header');
  tower.append(head);
  const rows: HTMLElement[] = [];
  for (let index = 0; index < rowCount; index += 1) {
    const row = document.createElement('li');
    tower.append(row);
    rows.push(row);
  }
  document.body.append(tower);
  onTestFinished(() => tower.remove());
  return { tower, head, rows };
}

type TowerPieces = ReturnType<typeof createTowerPiecesInAnEmptyPage>;

const timelineLengthScenarios = [
  // playAction: the head's --motion-in, then 20 rows each one stagger later: 400 + 20 × 30.
  {
    name: 'the play-in with 20 rows lasts --motion-in plus 20 staggers (1000 ms)',
    build: (pieces: TowerPieces) => buildPlayInTimeline(pieces.tower, pieces.head, pieces.rows),
    expectedMs: 1000,
  },
  // stopAction: everything together over --motion-out.
  {
    name: 'the stop-out lasts --motion-out (250 ms)',
    build: (pieces: TowerPieces) => buildStopOutTimeline(pieces.tower, pieces.head, pieces.rows),
    expectedMs: 250,
  },
  // A page turn's first half: the rows out together.
  {
    name: 'the rows-out lasts --motion-out (250 ms)',
    build: (pieces: TowerPieces) => buildRowsOutTimeline(pieces.tower, pieces.rows),
    expectedMs: 250,
  },
  // A page turn's second half: the first row at once, each next one a stagger later.
  {
    name: 'the rows-in with 20 rows lasts --motion-in plus 19 staggers (970 ms)',
    build: (pieces: TowerPieces) => buildRowsInTimeline(pieces.tower, pieces.rows),
    expectedMs: 970,
  },
  // An update with a slide, a car entering and a car leaving: all start together, so
  // the timeline is as long as the longest (--motion-swap and --motion-in are 400).
  {
    name: 'an update with a slide, a rise and a lift lasts the longest of them (400 ms)',
    build: (pieces: TowerPieces) =>
      buildUpdateTimeline(pieces.tower, {
        slotShifts: [{ element: pieces.rows[0]!, shiftPx: 37 }],
        rowsEntering: [pieces.rows[1]!],
        rowsLeaving: [pieces.rows[2]!],
      }),
    expectedMs: 400,
  },
  // The cue hold: nothing moves for --motion-cue-hold, then the clear.
  {
    name: 'the cue hold lasts --motion-cue-hold (2000 ms)',
    build: (pieces: TowerPieces) => buildCueHoldTimeline(pieces.tower, () => {}),
    expectedMs: 2000,
  },
];

describe('tower timelines with the Ardósia tokens on the page', () => {
  it.each(timelineLengthScenarios)('$name', ({ build, expectedMs }) => {
    // Arrange: the theme's motion tokens on :root and a tower with 20 rows.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const pieces = createTowerPiecesInAnEmptyPage(20);

    // Act: build the timeline (paused; nothing moves yet) and measure it.
    const timeline = build(pieces);
    const timelineLengthMs = Math.round(timeline.duration() * 1000);
    timeline.kill();

    // Assert: it lasts exactly what the tokens say.
    expect(timelineLengthMs, 'the timeline must last exactly what its motion tokens say').toBe(
      expectedMs,
    );
  });
});

describe('tower timelines on a page without the theme', () => {
  it('build with no length at all, so every action still ends at once', () => {
    // Arrange: no token on :root (nothing was placed), and a tower with 20 rows.
    const pieces = createTowerPiecesInAnEmptyPage(20);

    // Act: build the play-in and measure it.
    const timeline = buildPlayInTimeline(pieces.tower, pieces.head, pieces.rows);
    const timelineLengthMs = timeline.duration() * 1000;
    timeline.kill();

    // Assert: a missing token reads as 0 ms, never as a timeline that never ends.
    expect(timelineLengthMs, 'without the theme the play-in must last 0 ms').toBe(0);
  });
});

describe('a FLIP slide', () => {
  it('starts the row from where it was and ends it where it is', () => {
    // Arrange: the tokens on :root and a row measured 37 px lower before the DOM change.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const pieces = createTowerPiecesInAnEmptyPage(1);
    const row = pieces.rows[0]!;
    const timeline = buildUpdateTimeline(pieces.tower, {
      slotShifts: [{ element: row, shiftPx: 37 }],
      rowsEntering: [],
      rowsLeaving: [],
    });

    // Act: look at the row's transform at the start, half way and at the end.
    timeline.progress(0);
    const yAtTheStart = Number(gsap.getProperty(row, 'y'));
    timeline.progress(0.5);
    const yHalfWay = Number(gsap.getProperty(row, 'y'));
    timeline.progress(1);
    const yAtTheEnd = Number(gsap.getProperty(row, 'y'));
    timeline.kill();

    // Assert: drawn 37 px down (where it was), between on the way, in place at the end.
    expect(yAtTheStart, 'the slide must start from the measured shift').toBe(37);
    expect(yHalfWay, 'half way the row must be between the two places').toBeGreaterThan(0);
    expect(yHalfWay, 'half way the row must be between the two places').toBeLessThan(37);
    expect(yAtTheEnd, 'the slide must end in place').toBe(0);
  });
});

describe('the cue hold', () => {
  it('calls the clear once the hold has passed, not before', () => {
    // Arrange: the tokens on :root and a hold that counts its clears.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const pieces = createTowerPiecesInAnEmptyPage(0);
    let clearCount = 0;
    const timeline = buildCueHoldTimeline(pieces.tower, () => {
      clearCount += 1;
    });

    // Act: go half way through the hold, then to its end.
    timeline.progress(0.5);
    const clearsHalfWay = clearCount;
    timeline.progress(1);
    timeline.kill();

    // Assert: no clear during the hold, one clear at its end.
    expect(clearsHalfWay, 'the cues must stay for the whole hold').toBe(0);
    expect(clearCount, 'the cues must be cleared once at the end of the hold').toBe(1);
  });
});

describe('playTimelineToTheEnd', () => {
  it('jumps to the end and resolves at once when skipAnimation is set', async () => {
    // Arrange: a play-in timeline that would normally take a second.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const pieces = createTowerPiecesInAnEmptyPage(20);
    const timeline = buildPlayInTimeline(pieces.tower, pieces.head, pieces.rows);

    // Act: play it with skipAnimation, as a renderer may ask.
    await playTimelineToTheEnd(timeline, { skipAnimation: true });

    // Assert: the timeline is already at its end and the head is on screen.
    expect(timeline.progress(), 'skipAnimation must jump straight to the end').toBe(1);
    expect(pieces.head.style.opacity, 'the head must be visible at the end').toBe('1');
  });

  it('kills a timeline it jumped to the end with skipAnimation, so GSAP keeps nothing', async () => {
    // Arrange: a stop-out timeline on the head and rows.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const pieces = createTowerPiecesInAnEmptyPage(3);
    const timeline = buildStopOutTimeline(pieces.tower, pieces.head, pieces.rows);

    // Act: play it with skipAnimation.
    await playTimelineToTheEnd(timeline, { skipAnimation: true });

    // Assert: no tween on the head is left behind in GSAP.
    expect(
      gsap.getTweensOf(pieces.head),
      'a finished timeline must be killed, or a day on air in OBS piles them up',
    ).toEqual([]);
  });

  it('kills a timeline it played to the end in real time, so GSAP keeps nothing', async () => {
    // Arrange: a rows-out timeline (250 ms of real animation) on three rows.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const pieces = createTowerPiecesInAnEmptyPage(3);
    const timeline = buildRowsOutTimeline(pieces.tower, pieces.rows);

    // Act: play it through and wait until it has finished.
    await playTimelineToTheEnd(timeline, { skipAnimation: false });

    // Assert: the rows ended invisible and no tween on them is left behind in GSAP.
    expect(pieces.rows[0]?.style.opacity, 'the out animation must have ended').toBe('0');
    expect(
      gsap.getTweensOf(pieces.rows[0]!),
      'a finished timeline must be killed, or a day on air in OBS piles them up',
    ).toEqual([]);
  });
});

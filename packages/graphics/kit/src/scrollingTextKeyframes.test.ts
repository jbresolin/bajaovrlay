/**
 * A scrolling text's cycle as Web Animation keyframes (packages/graphics/kit)
 *
 * What this module is for:
 *   The clock (scrollingTextWhenTooLong.ts) hands each text too long for its box to the
 *   browser as one Web Animation over the whole cycle: keyframes of `transform` and
 *   `opacity` only, which Chromium runs on its compositor thread, so the scroll keeps its
 *   60 frames a second even when OBS's page is busy (positionsTowerFrameBudget.e2e.ts).
 *   This module turns one text's cycle (scrollingTextCycle.ts) into those keyframes.
 *
 * What these tests prove:
 *   - The keyframes of a text 1 px too long, one by one: the hold at the start, the scroll,
 *     the hold at the end, the fade out where it stands, the jump back unseen, the fade in.
 *   - Read between their offsets the way a browser reads them (linearly), the keyframes put
 *     a text exactly where readScrollingTextPhaseAt says, at every moment of a shared cycle,
 *     for the shortest and the longest of three texts.
 *   - A text not in the cycle gets no keyframes at all.
 *
 * What these tests deliberately do not cover:
 *   - Running the animation; jsdom has no Web Animations. The clock's tests check what is
 *     handed to `animate`, the browser tests of the graphics see it run.
 */
import { describe, expect, it } from 'vitest';

import {
  planScrollingTextCycle,
  readScrollingTextPhaseAt,
  type ScrollingTextMeasure,
} from './scrollingTextCycle.js';
import {
  buildScrollingTextKeyframes,
  type ScrollingTextKeyframe,
} from './scrollingTextKeyframes.js';
import type { ScrollingTextTimings } from './scrollingTextTimings.js';

/** Ardósia's starting values: 2.5 s at the start, 60 px/s, 1.5 s at the end, 250 ms back. */
const ardosiaTextTimings: ScrollingTextTimings = {
  holdStartMs: 2500,
  scrollSpeedPxPerSecond: 60,
  holdEndMs: 1500,
  returnMs: 250,
  edgeFadePx: 24,
};

/** Builds the measures of named texts, each in a 300 px box (the tower's team column). */
function measureTextsInTowerTeamBoxes(
  textWidthsByName: Record<string, number>,
): Map<string, ScrollingTextMeasure> {
  const measures = new Map<string, ScrollingTextMeasure>();
  for (const [name, textWidthPx] of Object.entries(textWidthsByName)) {
    measures.set(name, { textWidthPx, boxWidthPx: 300 });
  }
  return measures;
}

/** The pixels a `translateX(…px)` keyframe moves the text by. */
function readOffsetPx(keyframe: ScrollingTextKeyframe): number {
  return Number.parseFloat(keyframe.transform.replace('translateX(', ''));
}

/**
 * Where the keyframes put a text at a share of the cycle (0 to 1), read the way a browser
 * reads linear keyframes: between the last keyframe at or before the moment and the next
 * one after it. Two keyframes at the same offset are a jump: the later one wins from there.
 */
function readKeyframesAt(
  keyframes: ScrollingTextKeyframe[],
  shareOfTheCycle: number,
): { offsetPx: number; opacity: number } {
  let before = keyframes[0];
  let after = keyframes[keyframes.length - 1];
  for (const keyframe of keyframes) {
    if (keyframe.offset <= shareOfTheCycle) {
      before = keyframe;
    }
  }
  for (const keyframe of [...keyframes].reverse()) {
    if (keyframe.offset > shareOfTheCycle) {
      after = keyframe;
    }
  }
  if (before === undefined || after === undefined) {
    throw new Error('no keyframes to read');
  }
  const span = after.offset - before.offset;
  const progress = span === 0 ? 0 : (shareOfTheCycle - before.offset) / span;
  return {
    offsetPx: readOffsetPx(before) + (readOffsetPx(after) - readOffsetPx(before)) * progress,
    opacity: before.opacity + (after.opacity - before.opacity) * progress,
  };
}

describe('buildScrollingTextKeyframes', () => {
  it('writes the cycle of a text 1 px too long as seven keyframes', () => {
    // Arrange: one name 1 px wider than its box: 25 px to scroll in 416.67 ms.
    const cycle = planScrollingTextCycle(
      measureTextsInTowerTeamBoxes({ 'EQUIPE CARCARÁ BAJA UFRN': 301 }),
      ardosiaTextTimings,
    );
    const durationMs = cycle.durationMs;

    // Act: build its keyframes.
    const keyframes = buildScrollingTextKeyframes(
      cycle,
      'EQUIPE CARCARÁ BAJA UFRN',
      ardosiaTextTimings,
    );

    // Assert: start, hold, scroll, hold, fade out, jump back, fade in.
    const scrollEndsAtMs = 2500 + (25 / 60) * 1000;
    expect(keyframes, 'the seven keyframes of the cycle, in order').toEqual([
      { offset: 0, transform: 'translateX(0px)', opacity: 1 },
      { offset: 2500 / durationMs, transform: 'translateX(0px)', opacity: 1 },
      { offset: scrollEndsAtMs / durationMs, transform: 'translateX(-25px)', opacity: 1 },
      { offset: (durationMs - 250) / durationMs, transform: 'translateX(-25px)', opacity: 1 },
      { offset: (durationMs - 125) / durationMs, transform: 'translateX(-25px)', opacity: 0 },
      { offset: (durationMs - 125) / durationMs, transform: 'translateX(0px)', opacity: 0 },
      { offset: 1, transform: 'translateX(0px)', opacity: 1 },
    ]);
  });

  it('moves only transform and opacity, the two properties the compositor runs alone', () => {
    // Arrange: one long school.
    const cycle = planScrollingTextCycle(
      measureTextsInTowerTeamBoxes({ 'UNIVERSIDADE TECNOLÓGICA FEDERAL DO PARANÁ': 1236 }),
      ardosiaTextTimings,
    );

    // Act: build its keyframes.
    const keyframes = buildScrollingTextKeyframes(
      cycle,
      'UNIVERSIDADE TECNOLÓGICA FEDERAL DO PARANÁ',
      ardosiaTextTimings,
    );

    // Assert: every keyframe names offset, transform and opacity, nothing else.
    for (const keyframe of keyframes) {
      expect(Object.keys(keyframe).sort(), 'only transform and opacity may move').toEqual([
        'offset',
        'opacity',
        'transform',
      ]);
    }
  });

  it('gives no keyframes to a text that is not in the cycle', () => {
    // Arrange: a name that fits, so it is not in the cycle.
    const cycle = planScrollingTextCycle(
      measureTextsInTowerTeamBoxes({ 'BAJA UFPR': 180 }),
      ardosiaTextTimings,
    );

    // Act: build its keyframes.
    const keyframes = buildScrollingTextKeyframes(cycle, 'BAJA UFPR', ardosiaTextTimings);

    // Assert: nothing to animate.
    expect(keyframes, 'a text that fits must not be animated').toEqual([]);
  });

  const namesSharingOneCycle = [
    // The shortest overflow: it scrolls for 1 s, then waits at its end for 9 s.
    { name: 'EQUIPE BAJA MANGUE BAJA UFPE' },
    // The longest: it sets the cycle's length.
    {
      name: 'INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA FLUMINENSE - IFF - CAMPUS ITAPERUNA',
    },
  ];

  it.each(namesSharingOneCycle)(
    'puts "$name" where the pure cycle says, at every moment',
    ({ name }) => {
      // Arrange: three names in one cycle.
      const cycle = planScrollingTextCycle(
        measureTextsInTowerTeamBoxes({
          'EQUIPE BAJA MANGUE BAJA UFPE': 336,
          'EQUIPE TUCANO BAJA UNIVERSIDADE FEDERAL DE SANTA CATARINA': 516,
          'INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA FLUMINENSE - IFF - CAMPUS ITAPERUNA': 876,
        }),
        ardosiaTextTimings,
      );

      // Act: build the text's keyframes and read them every 50 ms of the cycle.
      const keyframes = buildScrollingTextKeyframes(cycle, name, ardosiaTextTimings);
      const disagreements: string[] = [];
      for (let momentMs = 0; momentMs < cycle.durationMs; momentMs += 50) {
        const fromKeyframes = readKeyframesAt(keyframes, momentMs / cycle.durationMs);
        const fromCycle = readScrollingTextPhaseAt(cycle, name, momentMs, ardosiaTextTimings);
        const isSameOffset = Math.abs(fromKeyframes.offsetPx - fromCycle.offsetPx) < 0.001;
        const isSameOpacity = Math.abs(fromKeyframes.opacity - fromCycle.opacity) < 0.001;
        if (!isSameOffset || !isSameOpacity) {
          disagreements.push(`${String(momentMs)} ms`);
        }
      }

      // Assert: no moment where the browser would draw it elsewhere than the cycle says.
      expect(disagreements, 'the keyframes must agree with the pure cycle').toEqual([]);
    },
  );
});

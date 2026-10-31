/**
 * The cycle of a text too long for its box, as plain arithmetic (packages/graphics/kit)
 *
 * What this module is for:
 *   A name too long for its box ("UNIVERSIDADE TECNOLÓGICA FEDERAL DO PARANÁ - CORNÉLIO
 *   PROCÓPIO" in a tower row) is not cut with an ellipsis: it holds at its start, scrolls at
 *   a constant speed until its end shows, holds there, crossfades back to its start and
 *   starts again. Every such text of one graphic shares one cycle, so a tower of 20 rows
 *   moves together. This module answers, from the widths and the theme's timings alone,
 *   how long a cycle lasts and where each text is at a given moment of it; the graphic's
 *   GSAP timeline is built from the very same moments (scrollingTextWhenTooLong.ts).
 *
 * What these tests prove:
 *   - A text that fits never moves and is not part of the cycle.
 *   - A text 1 px too long still scrolls (by that pixel plus the edge fade), at the same
 *     speed as any other.
 *   - A very long name scrolls at the same speed, so it takes longer, never faster.
 *   - Three texts share one cycle: they start together, the shortest waits at its end for
 *     the longest, and all of them crossfade back at the same moment.
 *   - A text that changes during a scroll leaves the cycle and rests at its start, the
 *     others go on unchanged, and the next cycle takes it in with its new width.
 *   - The crossfade back is half a fade out at the end and half a fade in at the start.
 *
 * What these tests deliberately do not cover:
 *   - Measuring the widths on the page and running the cycle with GSAP;
 *     scrollingTextWhenTooLong.test.ts covers those.
 *   - Reading the timings from the theme; scrollingTextTimings.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  leaveTextOutOfTheCycle,
  planScrollingTextCycle,
  readPhaseMomentsOfText,
  readScrollingTextPhaseAt,
  type ScrollingTextMeasure,
} from './scrollingTextCycle.js';
import type { ScrollingTextTimings } from './scrollingTextTimings.js';

/** Ardósia's starting values: 2.5 s at the start, 60 px/s, 1.5 s at the end, 250 ms back. */
const ardosiaTextTimings: ScrollingTextTimings = {
  holdStartMs: 2500,
  scrollSpeedPxPerSecond: 60,
  holdEndMs: 1500,
  returnMs: 250,
  edgeFadePx: 24,
};

/** The width of a tower row's team cell in the detailed layout, the box every row shares. */
const towerTeamBoxWidthPx = 300;

/** Builds the measures of named texts, each in a box as wide as the tower's team cell. */
function measureTextsInTowerTeamBoxes(
  textWidthsByName: Record<string, number>,
): Map<string, ScrollingTextMeasure> {
  const measures = new Map<string, ScrollingTextMeasure>();
  for (const [name, textWidthPx] of Object.entries(textWidthsByName)) {
    measures.set(name, { textWidthPx, boxWidthPx: towerTeamBoxWidthPx });
  }
  return measures;
}

describe('a text that fits its box', () => {
  it('is left out of the cycle and rests at its start at every moment', () => {
    // Arrange: "BAJA UFPR" is 180 px wide in a 300 px box, alone in the graphic.
    const measures = measureTextsInTowerTeamBoxes({ 'BAJA UFPR': 180 });

    // Act: plan the cycle and read the text at the start, during and long after it.
    const cycle = planScrollingTextCycle(measures, ardosiaTextTimings);
    const phases = [0, 3000, 60_000].map((momentMs) =>
      readScrollingTextPhaseAt(cycle, 'BAJA UFPR', momentMs, ardosiaTextTimings),
    );

    // Assert: there is no cycle at all, and the text never moves nor fades.
    expect(cycle.durationMs, 'a graphic whose texts all fit must have no cycle').toBe(0);
    expect(cycle.scrollDistancePxByName.has('BAJA UFPR'), 'a fitting text must not join').toBe(
      false,
    );
    for (const phase of phases) {
      expect(phase, 'a fitting text must rest at its start, fully shown').toEqual({
        phase: 'restingAtStart',
        offsetPx: 0,
        opacity: 1,
      });
    }
  });

  it('counts a text exactly as wide as its box as fitting', () => {
    // Arrange: a name that fills its 300 px box to the pixel.
    const measures = measureTextsInTowerTeamBoxes({ 'EQUIPE PIRATAS DO CERRADO': 300 });

    // Act: plan the cycle.
    const cycle = planScrollingTextCycle(measures, ardosiaTextTimings);

    // Assert: nothing is cut, so nothing scrolls.
    expect(cycle.durationMs, 'a text exactly as wide as its box must not scroll').toBe(0);
  });
});

describe('a text 1 px too long', () => {
  // 1 px over plus the 24 px edge fade: 25 px at 60 px/s is 416.67 ms of scroll.
  const scrollMs = (25 / 60) * 1000;

  const phaseScenarios = [
    // The last moment of the hold: the start still shows, the box has no fade yet.
    {
      name: 'holds at its start for the whole hold',
      momentMs: 2499,
      expected: { phase: 'holdingAtStart', offsetPx: 0, opacity: 1 },
    },
    // Halfway through its scroll, 12.5 px along: the speed is the theme's, not a fixed time.
    {
      name: 'is halfway at 60 px/s halfway through its scroll',
      momentMs: 2500 + scrollMs / 2,
      expected: { phase: 'scrolling', offsetPx: -12.5, opacity: 1 },
    },
    // Scrolled by the pixel it was over plus the fade, so its last letter clears the fade.
    {
      name: 'holds at its end once scrolled',
      momentMs: 2500 + scrollMs + 1,
      expected: { phase: 'holdingAtEnd', offsetPx: -25, opacity: 1 },
    },
    // The first half of the 250 ms return: the end fading out where it stands.
    {
      name: 'fades out at its end in the first half of the return',
      momentMs: 2500 + scrollMs + 1500 + 62.5,
      expected: { phase: 'fadingOutAtEnd', offsetPx: -25, opacity: 0.5 },
    },
    // The second half: back at its start, fading in.
    {
      name: 'fades in at its start in the second half of the return',
      momentMs: 2500 + scrollMs + 1500 + 125 + 62.5,
      expected: { phase: 'fadingInAtStart', offsetPx: 0, opacity: 0.5 },
    },
  ];

  it.each(phaseScenarios)('$name', ({ momentMs, expected }) => {
    // Arrange: a team name one pixel wider than its 300 px box.
    const measures = measureTextsInTowerTeamBoxes({ 'EQUIPE CARCARÁ BAJA UFRN': 301 });
    const cycle = planScrollingTextCycle(measures, ardosiaTextTimings);

    // Act: read where it is at this moment of the cycle.
    const phase = readScrollingTextPhaseAt(
      cycle,
      'EQUIPE CARCARÁ BAJA UFRN',
      momentMs,
      ardosiaTextTimings,
    );

    // Assert: the phase, the offset and the opacity are the expected ones.
    expect(phase.phase, 'the text must be in the expected phase').toBe(expected.phase);
    expect(phase.offsetPx, 'the text must be moved by the expected pixels').toBeCloseTo(
      expected.offsetPx,
      6,
    );
    expect(phase.opacity, 'the text must have the expected opacity').toBeCloseTo(
      expected.opacity,
      6,
    );
  });

  it('lasts the two holds, its scroll and the return', () => {
    // Arrange: the same name one pixel too long.
    const measures = measureTextsInTowerTeamBoxes({ 'EQUIPE CARCARÁ BAJA UFRN': 301 });

    // Act: plan the cycle.
    const cycle = planScrollingTextCycle(measures, ardosiaTextTimings);

    // Assert: 2500 + 416.67 + 1500 + 250 ms.
    expect(cycle.durationMs, 'the cycle must be the holds, the scroll and the return').toBeCloseTo(
      2500 + scrollMs + 1500 + 250,
      6,
    );
  });
});

describe('a very long name', () => {
  it('scrolls at the same speed as a short one, so it takes longer', () => {
    // Arrange: the longest school in the field, 1236 px in a 300 px box: 936 px over,
    // 960 px to scroll with the edge fade, 16 s at 60 px/s.
    const measures = measureTextsInTowerTeamBoxes({
      'UNIVERSIDADE TECNOLÓGICA FEDERAL DO PARANÁ - CORNÉLIO PROCÓPIO': 1236,
    });
    const cycle = planScrollingTextCycle(measures, ardosiaTextTimings);

    // Act: read it one second into its scroll and at the end of its scroll.
    const oneSecondIn = readScrollingTextPhaseAt(
      cycle,
      'UNIVERSIDADE TECNOLÓGICA FEDERAL DO PARANÁ - CORNÉLIO PROCÓPIO',
      2500 + 1000,
      ardosiaTextTimings,
    );
    const moments = readPhaseMomentsOfText(
      cycle,
      'UNIVERSIDADE TECNOLÓGICA FEDERAL DO PARANÁ - CORNÉLIO PROCÓPIO',
      ardosiaTextTimings,
    );

    // Assert: 60 px after one second, like any text, and the scroll lasts 16 s.
    expect(oneSecondIn.offsetPx, 'a long name must move at 60 px/s, not faster').toBeCloseTo(
      -60,
      6,
    );
    expect(moments?.scrollEndsAtMs, 'its scroll must end 16 s after the hold').toBeCloseTo(
      2500 + 16_000,
      6,
    );
    expect(cycle.durationMs, 'the cycle must stretch to fit the long scroll').toBeCloseTo(
      2500 + 16_000 + 1500 + 250,
      6,
    );
  });
});

describe('one clock shared by three texts', () => {
  /** Three names of one tower page: one short overflow, one medium, one very long. */
  function planThreeTowerNames() {
    const measures = measureTextsInTowerTeamBoxes({
      // 36 px over, 60 px to scroll: 1 s.
      'EQUIPE BAJA MANGUE BAJA UFPE': 336,
      // 216 px over, 240 px to scroll: 4 s.
      'EQUIPE TUCANO BAJA UNIVERSIDADE FEDERAL DE SANTA CATARINA': 516,
      // 576 px over, 600 px to scroll: 10 s, the longest.
      'INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA FLUMINENSE - IFF - CAMPUS ITAPERUNA': 876,
    });
    return planScrollingTextCycle(measures, ardosiaTextTimings);
  }

  it('lasts as long as the longest text needs', () => {
    // Arrange: nothing beyond the three names.

    // Act: plan their cycle.
    const cycle = planThreeTowerNames();

    // Assert: the hold, the longest scroll (10 s), the end hold and the return.
    expect(cycle.durationMs, 'the shared cycle must be set by the longest text').toBeCloseTo(
      2500 + 10_000 + 1500 + 250,
      6,
    );
  });

  it('starts all three together and brings all three back together', () => {
    // Arrange: the three names planned in one cycle.
    const cycle = planThreeTowerNames();
    const names = [...cycle.scrollDistancePxByName.keys()];

    // Act: read the moments of each.
    const momentsOfEach = names.map((name) =>
      readPhaseMomentsOfText(cycle, name, ardosiaTextTimings),
    );

    // Assert: same scroll start, same return start, same cycle end; different scroll ends.
    const scrollStarts = new Set(momentsOfEach.map((moments) => moments?.scrollStartsAtMs));
    const returnStarts = new Set(momentsOfEach.map((moments) => moments?.returnStartsAtMs));
    const scrollEnds = new Set(momentsOfEach.map((moments) => moments?.scrollEndsAtMs));
    expect([...scrollStarts], 'every text must start scrolling at the same moment').toEqual([
      2500,
    ]);
    expect([...returnStarts], 'every text must start its return at the same moment').toEqual([
      2500 + 10_000 + 1500,
    ]);
    expect(scrollEnds.size, 'each text must scroll for as long as its own length needs').toBe(3);
  });

  it('keeps the shortest at its end while the longest still scrolls', () => {
    // Arrange: the three names planned in one cycle.
    const cycle = planThreeTowerNames();

    // Act: read all three 5 s into the cycle (2.5 s into the scroll).
    const shortest = readScrollingTextPhaseAt(
      cycle,
      'EQUIPE BAJA MANGUE BAJA UFPE',
      5000,
      ardosiaTextTimings,
    );
    const longest = readScrollingTextPhaseAt(
      cycle,
      'INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA FLUMINENSE - IFF - CAMPUS ITAPERUNA',
      5000,
      ardosiaTextTimings,
    );

    // Assert: the short one rests at its end, the long one is 150 px along.
    expect(shortest, 'the shortest must hold at its end, waiting for the others').toEqual({
      phase: 'holdingAtEnd',
      offsetPx: -60,
      opacity: 1,
    });
    expect(longest.phase, 'the longest must still be scrolling').toBe('scrolling');
    expect(longest.offsetPx, 'the longest must be 2.5 s along at 60 px/s').toBeCloseTo(-150, 6);
  });
});

describe('a text that changes during a scroll', () => {
  it('rests at its start until the next cycle while the others go on', () => {
    // Arrange: two tower rows scrolling in one cycle, 4 s in (1.5 s into the scroll).
    const measures = measureTextsInTowerTeamBoxes({
      'EQUIPE TUCANO BAJA UNIVERSIDADE FEDERAL DE SANTA CATARINA': 516,
      'INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA FLUMINENSE - IFF - CAMPUS ITAPERUNA': 876,
    });
    const cycle = planScrollingTextCycle(measures, ardosiaTextTimings);
    const durationBefore = cycle.durationMs;

    // Act: the first row now shows another car's name: it leaves the running cycle.
    const cycleAfterTheChange = leaveTextOutOfTheCycle(
      cycle,
      'EQUIPE TUCANO BAJA UNIVERSIDADE FEDERAL DE SANTA CATARINA',
    );
    const changed = readScrollingTextPhaseAt(
      cycleAfterTheChange,
      'EQUIPE TUCANO BAJA UNIVERSIDADE FEDERAL DE SANTA CATARINA',
      4000,
      ardosiaTextTimings,
    );
    const unchanged = readScrollingTextPhaseAt(
      cycleAfterTheChange,
      'INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA FLUMINENSE - IFF - CAMPUS ITAPERUNA',
      4000,
      ardosiaTextTimings,
    );

    // Assert: the changed text is back at its start, the other is where it was, and the
    // cycle keeps its length so no other text jumps.
    expect(changed, 'the changed text must rest at its start, fully shown').toEqual({
      phase: 'restingAtStart',
      offsetPx: 0,
      opacity: 1,
    });
    expect(unchanged.phase, 'the other text must go on scrolling').toBe('scrolling');
    expect(unchanged.offsetPx, 'the other text must be 1.5 s along, untouched').toBeCloseTo(-90, 6);
    expect(cycleAfterTheChange.durationMs, 'the running cycle must keep its length').toBe(
      durationBefore,
    );
  });

  it('joins the next cycle with its new width', () => {
    // Arrange: the row's new name is longer still, measured when the next cycle starts.
    const measuresAtTheNextCycle = measureTextsInTowerTeamBoxes({
      'UNIVERSIDADE TECNOLÓGICA FEDERAL DO PARANÁ - CORNÉLIO PROCÓPIO': 1236,
    });

    // Act: plan the next cycle.
    const nextCycle = planScrollingTextCycle(measuresAtTheNextCycle, ardosiaTextTimings);

    // Assert: it scrolls by its new overflow plus the edge fade.
    expect(
      nextCycle.scrollDistancePxByName.get(
        'UNIVERSIDADE TECNOLÓGICA FEDERAL DO PARANÁ - CORNÉLIO PROCÓPIO',
      ),
      'the next cycle must scroll the new text by its own overflow plus the fade',
    ).toBe(960);
  });
});

describe('after the cycle has ended', () => {
  it('reads every text at its start, ready for the next cycle', () => {
    // Arrange: one name 1 px too long.
    const measures = measureTextsInTowerTeamBoxes({ 'EQUIPE CARCARÁ BAJA UFRN': 301 });
    const cycle = planScrollingTextCycle(measures, ardosiaTextTimings);

    // Act: read it exactly at the cycle's end.
    const phase = readScrollingTextPhaseAt(
      cycle,
      'EQUIPE CARCARÁ BAJA UFRN',
      cycle.durationMs,
      ardosiaTextTimings,
    );

    // Assert: back at its start, fully shown, as the next cycle begins.
    expect(phase, 'at the end of the cycle the text must be at its start').toEqual({
      phase: 'restingAtStart',
      offsetPx: 0,
      opacity: 1,
    });
  });
});

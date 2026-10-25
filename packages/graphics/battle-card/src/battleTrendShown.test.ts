/**
 * The battle card's trend as shown: set by hand, and its words (packages/graphics/battle-card)
 *
 * What this module is for:
 *   Besides the trend it works out lap by lap (battleTrend.test.ts), the battle card takes a
 *   trend set by hand by the operator, which then wins, and writes either as the words of the
 *   trend cell ("FECHANDO −0,7", "ABRINDO +0,7", "ESTÁVEL"). battleTrend.ts holds these rules
 *   as pure functions.
 *
 * What these tests prove:
 *   - A trend set by hand always wins over the worked-out one, its change signed by its word.
 *   - Beside a gap of "—" no trend is shown at all, not even one set by hand (gate 2 of
 *     PR #27).
 *   - The words use the decimal comma, the tenth cut (never rounded) and the typographic
 *     minus (U+2212), never the hyphen.
 *
 * What these tests deliberately do not cover:
 *   - The trend worked out from the gap: battleTrend.test.ts.
 *   - Drawing the words, the shape and the colour: battleCardView.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { chooseTrendToShow, type TrendShown, writeTrendWords } from './battleTrend.js';
import {
  followReadings,
  readFeiAfterPassingImperador,
  readFeiBehindImperador,
} from './battleTrendReadings.testSupport.js';

describe('a trend set by hand', () => {
  const manualScenarios = [
    // The worked-out trend is opening; the operator says closing by 0,7 s: hand wins.
    {
      name: 'wins over the worked-out trend, its change shown as a closing minus',
      setByHand: { manualTrend: 'closing' as const, manualTrendChangeMs: 700 },
      expected: { word: 'closing', changeMs: -700 },
    },
    // The change typed is a size; opening shows it with a plus.
    {
      name: 'shows an opening change with a plus',
      setByHand: { manualTrend: 'opening' as const, manualTrendChangeMs: 700 },
      expected: { word: 'opening', changeMs: 700 },
    },
    // A trend by hand without a change shows the word alone.
    {
      name: 'shows the word alone when no change is typed',
      setByHand: { manualTrend: 'closing' as const },
      expected: { word: 'closing', changeMs: undefined },
    },
    // Steady never carries a number, even if one was typed.
    {
      name: 'never shows a number on steady',
      setByHand: { manualTrend: 'steady' as const, manualTrendChangeMs: 300 },
      expected: { word: 'steady', changeMs: undefined },
    },
  ];

  it.each(manualScenarios)('$name', ({ setByHand, expected }) => {
    // Arrange: a memory whose worked-out trend is opening by 0,7 s.
    const memory = followReadings([
      readFeiBehindImperador(1, 2000),
      readFeiBehindImperador(2, 2700),
    ]);

    // Act: choose the trend with this row's trend set by hand.
    const trend = chooseTrendToShow(memory, setByHand, true);

    // Assert: the hand's trend, never the worked-out one.
    expect(trend, 'a trend set by hand must always win').toEqual(expected);
  });

  it('shows no trend beside a gap of "—", even one set by hand', () => {
    // Arrange: car 1 has passed car 8, and the operator had set closing by 0,7 s.
    const memory = followReadings([readFeiAfterPassingImperador(3, 6000)]);

    // Act: choose the trend with the gap not shown.
    const trend = chooseTrendToShow(
      memory,
      { manualTrend: 'closing', manualTrendChangeMs: 700 },
      false,
    );

    // Assert: no trend; beside no gap a trend would say what the card cannot show.
    expect(trend, 'no trend at all beside "—"').toEqual({ word: 'none', changeMs: undefined });
  });
});

describe('the words of the trend cell', () => {
  const wordScenarios: Array<{ name: string; trend: TrendShown; expected: string }> = [
    // The design's closing words, with the typographic minus.
    {
      name: 'writes closing by 0,7 s as "FECHANDO −0,7"',
      trend: { word: 'closing', changeMs: -700 },
      expected: 'FECHANDO −0,7',
    },
    // The design's opening words, with a plus.
    {
      name: 'writes opening by 0,7 s as "ABRINDO +0,7"',
      trend: { word: 'opening', changeMs: 700 },
      expected: 'ABRINDO +0,7',
    },
    // The tenth is cut like every race time: 0,79 s reads 0,7, never 0,8.
    {
      name: 'cuts the tenth: closing by 790 ms reads "FECHANDO −0,7"',
      trend: { word: 'closing', changeMs: -790 },
      expected: 'FECHANDO −0,7',
    },
    // A change past ten seconds keeps the comma (the design's "+11,0").
    {
      name: 'writes opening by 11 s as "ABRINDO +11,0"',
      trend: { word: 'opening', changeMs: 11_000 },
      expected: 'ABRINDO +11,0',
    },
    // Steady is the word alone.
    {
      name: 'writes steady as "ESTÁVEL"',
      trend: { word: 'steady', changeMs: undefined },
      expected: 'ESTÁVEL',
    },
  ];

  it.each(wordScenarios)('$name', ({ trend, expected }) => {
    // Arrange: the trend of this row.

    // Act: write its words.
    const words = writeTrendWords(trend);

    // Assert: the design's words, the comma and the right sign.
    expect(words, 'the trend words must be written as the design writes them').toBe(expected);
  });

  it('never writes the hyphen as the minus', () => {
    // Arrange: a closing trend.
    const closing: TrendShown = { word: 'closing', changeMs: -700 };

    // Act: write its words.
    const words = writeTrendWords(closing);

    // Assert: no hyphen, which Bebas Neue draws short and high.
    expect(words.includes('-'), 'the minus must be U+2212, never the hyphen').toBe(false);
  });
});

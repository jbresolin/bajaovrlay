/**
 * The battle card's DOM (packages/graphics/battle-card)
 *
 * What this module is for:
 *   battleCardView.ts draws, with Lit, the car ahead's pill, the gap card and the car
 *   behind's pill from what is on screen, the trend cell as two layers in one place.
 *
 * What these tests prove:
 *   - Each pill shows its car's position, number, team, school and laps ("1 VOLTA",
 *     "33 VOLTAS"); the gap card shows the gap text.
 *   - Only the leader's pill is marked for the green chip.
 *   - The trend cell's current layer carries its trend's word in data-trend (which picks
 *     its colour), its words and its shape (two triangles pointing in for closing, out for
 *     opening, a bar for steady); the incoming layer carries the incoming trend and is
 *     hidden from screen readers.
 *   - Redrawing with new texts keeps every element: the gap changes in place.
 *   - The three pieces and the two layers are found by findBattleCardParts.
 *
 * What these tests deliberately do not cover:
 *   - Colours, sizes and placement (the styles), which the screenshots pin.
 *   - Which trend is shown; battleTrend.test.ts and battle-card.trendOnAir.test.ts.
 */
import { render } from 'lit';
import { describe, expect, it, onTestFinished } from 'vitest';

import type { BattleCar } from './battleCardModel.js';
import {
  type BattleCardViewState,
  findBattleCardParts,
  renderBattleCardTemplate,
} from './battleCardView.js';

/** Imperador (8) 4th at lap 1. */
const imperadorAtLapOne: BattleCar = {
  position: 4,
  carNumber: 8,
  teamName: 'Imperador',
  schoolName: 'UTFPR-CWB',
  laps: 1,
};

/** Equipe FEI Baja (1) 5th at lap 33. */
const feiAtLapThirtyThree: BattleCar = {
  position: 5,
  carNumber: 1,
  teamName: 'Equipe FEI Baja',
  schoolName: 'FEI',
  laps: 33,
};

/** The battle closing by 0,7 s, at rest (both layers dressed alike). */
function createClosingViewState(): BattleCardViewState {
  return {
    carAhead: imperadorAtLapOne,
    carBehind: feiAtLapThirtyThree,
    gapText: '+2,0',
    trendOnScreen: { word: 'closing', changeMs: -700 },
    incomingTrend: { word: 'closing', changeMs: -700 },
  };
}

/** Draws a view state into a fresh container on the page, removed when the test ends. */
function drawIntoContainer(state: BattleCardViewState): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  onTestFinished(() => container.remove());
  render(renderBattleCardTemplate(state), container);
  return container;
}

/** Reads the text of one part found by its test id. */
function readText(container: HTMLElement, testId: string): string | null | undefined {
  return container.querySelector(`[data-testid="${testId}"]`)?.textContent;
}

describe('the pills and the gap card', () => {
  it('shows each car and the gap', () => {
    // Arrange: the battle closing.
    const state = createClosingViewState();

    // Act: draw it.
    const container = drawIntoContainer(state);

    // Assert: every cell, laps in words.
    expect(
      {
        aheadPosition: readText(container, 'battle-card-ahead-position'),
        aheadCarNumber: readText(container, 'battle-card-ahead-car-number'),
        aheadTeamName: readText(container, 'battle-card-ahead-team-name'),
        aheadSchoolName: readText(container, 'battle-card-ahead-school-name'),
        aheadLaps: readText(container, 'battle-card-ahead-laps'),
        behindLaps: readText(container, 'battle-card-behind-laps'),
        gap: readText(container, 'battle-card-gap'),
      },
      'each cell must show its car and the gap',
    ).toEqual({
      aheadPosition: '4',
      aheadCarNumber: '8',
      aheadTeamName: 'Imperador',
      aheadSchoolName: 'UTFPR-CWB',
      aheadLaps: '1 VOLTA',
      behindLaps: '33 VOLTAS',
      gap: '+2,0',
    });
  });

  it('marks only the leader’s pill for the green chip', () => {
    // Arrange: a battle for the lead.
    const state = {
      ...createClosingViewState(),
      carAhead: { ...imperadorAtLapOne, position: 1 },
      carBehind: { ...feiAtLapThirtyThree, position: 2 },
    };

    // Act: draw it.
    const container = drawIntoContainer(state);
    const parts = findBattleCardParts(container);

    // Assert: data-leader on the car ahead alone.
    expect(
      [
        parts.carAheadPill.hasAttribute('data-leader'),
        parts.carBehindPill.hasAttribute('data-leader'),
      ],
      'only position 1 sits on the green chip',
    ).toEqual([true, false]);
  });

  it('keeps every element when redrawn with new texts', () => {
    // Arrange: the battle drawn, and its gap element.
    const state = createClosingViewState();
    const container = drawIntoContainer(state);
    const gapBefore = container.querySelector('[data-testid="battle-card-gap"]');

    // Act: draw the next lap into the same container.
    render(renderBattleCardTemplate({ ...state, gapText: '+1,3' }), container);

    // Assert: the same element with the new text.
    expect(container.querySelector('[data-testid="battle-card-gap"]'), 'in place').toBe(gapBefore);
    expect(readText(container, 'battle-card-gap'), 'the new gap').toBe('+1,3');
  });
});

describe('the trend cell', () => {
  const shapeScenarios = [
    // Closing: two triangles pointing in.
    { word: 'closing' as const, changeMs: -700, words: 'FECHANDO −0,7', shapeParts: 2 },
    // Opening: two triangles pointing out.
    { word: 'opening' as const, changeMs: 700, words: 'ABRINDO +0,7', shapeParts: 2 },
    // Steady: a single bar.
    { word: 'steady' as const, changeMs: undefined, words: 'ESTÁVEL', shapeParts: 1 },
  ];

  it.each(shapeScenarios)(
    'draws $word with its word, words and shape',
    ({ word, changeMs, words, shapeParts }) => {
      // Arrange: the battle with this row's trend on screen.
      const trend = { word, changeMs };
      const state = { ...createClosingViewState(), trendOnScreen: trend, incomingTrend: trend };

      // Act: draw it.
      const container = drawIntoContainer(state);
      const parts = findBattleCardParts(container);

      // Assert: the colour key, the words and the shape's parts.
      expect(
        {
          dataTrend: parts.trendLayer.dataset.trend,
          words: readText(container, 'battle-card-trend-words'),
          shapeParts: parts.trendLayer.querySelectorAll('svg path, svg rect').length,
        },
        'the trend must read as a word, a number and a shape',
      ).toEqual({ dataTrend: word, words, shapeParts });
    },
  );

  it('dresses the incoming layer in the incoming trend, hidden from screen readers', () => {
    // Arrange: closing on screen, opening coming in.
    const state = {
      ...createClosingViewState(),
      incomingTrend: { word: 'opening' as const, changeMs: 700 },
    };

    // Act: draw it.
    const container = drawIntoContainer(state);
    const parts = findBattleCardParts(container);

    // Assert: each layer wears its own trend; only the current one is read aloud.
    expect(
      {
        current: parts.trendLayer.dataset.trend,
        incoming: parts.incomingTrendLayer.dataset.trend,
        incomingWords: readText(container, 'battle-card-incoming-trend-words'),
        isIncomingHidden: parts.incomingTrendLayer.getAttribute('aria-hidden'),
        isCurrentHidden: parts.trendLayer.getAttribute('aria-hidden'),
      },
      'the incoming layer must wear the incoming trend',
    ).toEqual({
      current: 'closing',
      incoming: 'opening',
      incomingWords: 'ABRINDO +0,7',
      isIncomingHidden: 'true',
      isCurrentHidden: 'false',
    });
  });
});

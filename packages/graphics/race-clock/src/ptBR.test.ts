/**
 * pt-BR catalog of the race clock (packages/graphics/race-clock)
 *
 * What this module is for:
 *   Every word the race clock puts on air (flag labels, the clock caption, the lap
 *   count) and every message it answers a renderer with comes from ptBR.ts, so the
 *   wording can be reviewed in one place.
 *
 * What these tests prove:
 *   - Each of the six flag states has the on-air label the brief asks for; "pre"
 *     (before the start), which the brief lists no label for, reads PRÉ-LARGADA.
 *   - The lap count reads naturally in the singular and the plural.
 *
 * What these tests deliberately do not cover:
 *   - Whether those words actually appear on screen; the Playwright screenshots show it.
 */
import { describe, expect, it } from 'vitest';

import { ptBR } from './ptBR.js';
import { flagStates } from './raceClockModel.js';

describe('flag labels', () => {
  it('has the brief’s on-air label for every flag state', () => {
    // Arrange: the six flag states the data schema allows.

    // Act: look up the label for each one.
    const labelsByState = Object.fromEntries(
      flagStates.map((flagState) => [flagState, ptBR.flagLabels[flagState]]),
    );

    // Assert: every state has its label, in capitals as shown on air.
    expect(labelsByState, 'every flag state must have its pt-BR on-air label').toEqual({
      pre: 'PRÉ-LARGADA',
      green: 'VERDE',
      yellow: 'AMARELA',
      red: 'VERMELHA',
      checkered: 'QUADRICULADA',
      finished: 'ENCERRADA',
    });
  });
});

describe('lap count', () => {
  const lapCountScenarios = [
    // Right after the start, the leader has done no laps yet.
    { name: 'reads 0 VOLTAS at the start', laps: 0, expected: '0 VOLTAS' },
    // One lap is singular in Portuguese.
    { name: 'reads 1 VOLTA after the first lap', laps: 1, expected: '1 VOLTA' },
    // Everything else is plural.
    { name: 'reads 12 VOLTAS mid-race', laps: 12, expected: '12 VOLTAS' },
  ];

  it.each(lapCountScenarios)('$name', ({ laps, expected }) => {
    // Arrange: the lap count comes from the scenario row above.

    // Act: build the on-air text.
    const lapText = ptBR.lapsCompletedByLeader(laps);

    // Assert: singular and plural read naturally.
    expect(lapText, 'the lap count must read naturally in pt-BR').toBe(expected);
  });
});

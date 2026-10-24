/**
 * pt-BR catalog of the lower third (packages/graphics/lower-third)
 *
 * What this module is for:
 *   The one mark the lower third adds on air (the dot between the role and the team
 *   line) and every message it answers a renderer with come from ptBR.ts, so the wording
 *   can be reviewed in one place. The name, role and team line are the operator's words.
 *
 * What these tests prove:
 *   - The separator is the design's middle dot.
 *   - The answers to a renderer call the graphic "tarja", the word the control page uses
 *     for the lower-third layer, so an operator reading a refusal knows what it is about.
 *
 * What these tests deliberately do not cover:
 *   - Whether the dot actually appears on screen; lowerThirdView.test.ts and the
 *     Playwright screenshots show it.
 */
import { describe, expect, it } from 'vitest';

import { ptBR } from './ptBR.js';

describe('the on-air mark', () => {
  it('separates the role from the team line with the design’s middle dot', () => {
    // Arrange: nothing to set up; the catalog is a constant.

    // Act: read the separator.
    const separator = ptBR.teamLineSeparator;

    // Assert: it is the middle dot of the design's "CAPITÃ DA EQUIPE · BAJA UFMG".
    expect(separator, 'the separator must be the design’s middle dot').toBe('·');
  });
});

describe('the answers to a renderer', () => {
  it('call the graphic "tarja" in every refusal', () => {
    // Arrange: every refusal sentence the lifecycle can answer.
    const refusals = [
      ptBR.actionProblems.notLoadedYet,
      ptBR.actionProblems.alreadyLoaded,
      ptBR.actionProblems.alreadyDisposed,
      ptBR.actionProblems.invalidPlayStep,
      ptBR.actionProblems.unknownCustomAction('trocar-pessoa'),
      ptBR.validationProblems.notAnObject,
    ];

    // Act: keep those that do not name the graphic.
    const refusalsWithoutTheWord = refusals.filter((refusal) => !refusal.includes('tarja'));

    // Assert: none is left.
    expect(refusalsWithoutTheWord, 'every refusal must name the graphic as "tarja"').toEqual([]);
  });
});

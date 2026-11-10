/**
 * pt-BR catalog of the Super Chat card (packages/graphics/super-chat)
 *
 * What this module is for:
 *   Every word the card puts on air and every message it answers a renderer with comes
 *   from ptBR.ts, so the wording can be reviewed in one place.
 *
 * What these tests prove:
 *   - The one fixed on-air word is "SUPER CHAT", in capitals, as YouTube names the feature
 *     (no YouTube logo is drawn).
 *   - The refusals a renderer reads name the Super Chat, in pt-BR.
 *
 * What these tests deliberately do not cover:
 *   - Whether those words appear on screen; superChatView.test.ts and the screenshots do.
 */
import { describe, expect, it } from 'vitest';

import { ptBR } from './ptBR.js';

describe('the fixed on-air word', () => {
  it('reads SUPER CHAT', () => {
    // Arrange: nothing to set up; the catalog is a constant.

    // Act: read the badge's word.
    const badgeWord = ptBR.superChatBadge;

    // Assert: the feature's name, in capitals.
    expect(badgeWord, 'the badge must read SUPER CHAT').toBe('SUPER CHAT');
  });
});

describe('the answers to a renderer', () => {
  it('name the Super Chat in pt-BR', () => {
    // Arrange: nothing to set up; the catalog is a constant.

    // Act: read the answers a renderer may get.
    const answers = [
      ptBR.actionProblems.notLoadedYet,
      ptBR.actionProblems.alreadyLoaded,
      ptBR.actionProblems.alreadyDisposed,
      ptBR.actionProblems.invalidPlayStep,
      ptBR.actionProblems.unknownCustomAction('destacar'),
    ];

    // Assert: each one says it is about the Super Chat.
    const answersNamingTheCard = answers.filter((answer) => answer.includes('Super Chat'));
    expect(answersNamingTheCard, 'every answer must name the Super Chat').toEqual(answers);
  });
});

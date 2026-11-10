/**
 * The superChats shape (packages/shared)
 *
 * What this module is for:
 *   The YouTube source (BAJAOVRLAY-35) answers each poll with the live chat's newest paid
 *   messages in this shape. The event inbox watches it for Super Chats it has not listed.
 *
 * What these tests prove:
 *   - A realistic answer passes, an empty message among it.
 *   - A message id listed twice is refused, in pt-BR, at the second one: the inbox keys
 *     events by it.
 *   - No graphic may bind to it: a viewer's text reaches the air only after approval.
 *
 * What these tests deliberately do not cover:
 *   - How the adapter builds it from YouTube's answer; the adapter's tests do.
 */
import { describe, expect, it } from 'vitest';

import { listBindablePathsOfShape } from './bindablePaths.js';
import type { SuperChatEntry } from './superChatsShape.js';
import { validateDataShape } from './validateDataShape.js';

/** A fictional viewer's R$ 50,00 Super Chat during the enduro. */
function buildSuperChatOfTorcidaCarnauba(): SuperChatEntry {
  return {
    messageId: 'mensagem-carnauba-0001',
    authorName: 'Torcida Carnaúba Baja',
    amountText: 'R$ 50,00',
    amountMicros: 50_000_000,
    currency: 'BRL',
    tier: 3,
    messageText: 'Força, Carnaúba! Mossoró está com vocês',
    publishedAtMs: Date.parse('2026-10-10T15:02:11.000Z'),
  };
}

/** A viewer who paid R$ 5,00 and wrote nothing. */
function buildSuperChatWithoutAMessage(): SuperChatEntry {
  return {
    messageId: 'mensagem-silenciosa-0002',
    authorName: 'Ana do Paddock',
    amountText: 'R$ 5,00',
    amountMicros: 5_000_000,
    currency: 'BRL',
    tier: 1,
    messageText: '',
    publishedAtMs: Date.parse('2026-10-10T15:03:40.000Z'),
  };
}

describe('the superChats shape', () => {
  it('accepts a realistic answer, one message empty', () => {
    // Arrange: two Super Chats, the second without a message.
    const payload = {
      updatedAtMs: Date.parse('2026-10-10T15:04:00.000Z'),
      entries: [buildSuperChatOfTorcidaCarnauba(), buildSuperChatWithoutAMessage()],
    };

    // Act: validate it.
    const validation = validateDataShape('superChats', payload);

    // Assert: it passes.
    expect(validation.isValid, 'a realistic answer must pass').toBe(true);
  });

  it('refuses a message id listed twice, at the second one', () => {
    // Arrange: the same Super Chat twice.
    const payload = {
      updatedAtMs: Date.parse('2026-10-10T15:04:00.000Z'),
      entries: [buildSuperChatOfTorcidaCarnauba(), buildSuperChatOfTorcidaCarnauba()],
    };

    // Act: validate it.
    const validation = validateDataShape('superChats', payload);

    // Assert: refused, naming the path and the id in pt-BR.
    expect(validation, 'a repeated id must be refused with its path').toEqual({
      isValid: false,
      errorMessage: expect.stringContaining('superChats.entries.1.messageId') as unknown,
    });
    expect(
      validation.isValid ? '' : validation.errorMessage,
      'the reason must name the repeated id',
    ).toContain('o Super Chat mensagem-carnauba-0001 aparece mais de uma vez');
  });

  it('offers no path for a binding', () => {
    // Arrange: nothing; the list is fixed in code.

    // Act: list the bindable paths of the shape.
    const paths = listBindablePathsOfShape('superChats');

    // Assert: none, so no graphic can follow the chat live.
    expect(paths, 'a Super Chat must never be bound straight to a graphic').toEqual([]);
  });
});

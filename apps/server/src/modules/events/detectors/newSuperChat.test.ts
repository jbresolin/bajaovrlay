/**
 * Detecting a viewer's new Super Chat (apps/server)
 *
 * What this module is for:
 *   A YouTube source (BAJAOVRLAY-35) answers each poll with the live chat's newest paid
 *   messages. The detector lists, as superChat events, the ones the previous answer did
 *   not have. Two promises pull against each other: never lose a Super Chat paid while the
 *   server was down, and never flood the inbox with an hour of chat history the first time
 *   a source is switched on. So a first poll (no previous answer) lists only the Super Chats
 *   published in the last 15 minutes and takes the older ones as already seen.
 *
 * What these tests prove, one row each:
 *   - A Super Chat the previous answer lacked fires one event, with the viewer, the amount
 *     and the message, and no car; one listed in both fires nothing.
 *   - A first poll lists the last 15 minutes only; one published 40 minutes ago is skipped.
 *   - After a restart (previous answer saved, adapter reading the chat afresh), a Super Chat
 *     paid while the server was down fires, and one older than everything the saved answer
 *     kept does not: it was seen and rolled out of the list, not missed. An empty saved
 *     answer counts as a first poll made at its own moment.
 *   - Event ids are `<sourceId>:superChat:<YouTube message id>`, so a Super Chat read again
 *     is the same event.
 *
 * What these tests deliberately do not cover:
 *   - Remembering the previous answer across polls and boots; superChatDetectionOnTheStore.test.ts.
 *   - The approval that follows; superChatModerationOnTheStore.test.ts.
 */
import type { SuperChatsShape } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { detectNewSuperChats } from './newSuperChat.js';
import {
  buildSuperChat,
  buildSuperChatOfAnaDoPaddock,
  buildSuperChatOfFamiliaCarnauba,
  buildSuperChatOfTorcidaPequi,
  buildSuperChats,
  pollArrivedAtMs,
} from './superChatsOfTheChat.testSupport.js';

/** The YouTube source of the tests. */
const sourceId = 'youtube-ao-vivo';

/** Where and when the new answer was accepted. */
const moment = { sourceId, detectedAtMs: pollArrivedAtMs };

describe('a new Super Chat between two answers', () => {
  it('fires one event with the viewer, the amount and the message, and no car', () => {
    // Arrange: Torcida Pequi's message in both answers, Família Carnaúba's only in the new one.
    const previous = buildSuperChats([buildSuperChatOfTorcidaPequi()]);
    const next = buildSuperChats([
      buildSuperChatOfTorcidaPequi(),
      buildSuperChatOfFamiliaCarnauba(),
    ]);

    // Act: detect between them.
    const events = detectNewSuperChats(previous, next, moment);

    // Assert: one event, Família Carnaúba's, keyed by its YouTube id.
    expect(events, 'only the Super Chat the previous answer lacked must fire').toEqual([
      {
        eventId: 'youtube-ao-vivo:superChat:mensagem-carnauba-0003',
        kind: 'superChat',
        sourceId,
        detectedAtMs: pollArrivedAtMs,
        payload: {
          authorName: 'Família Carnaúba',
          amountText: 'R$ 20,00',
          messageText: 'Vai, Baja! Um abraço de Família Carnaúba',
        },
      },
    ]);
  });

  it('fires the same id when the same change is detected twice', () => {
    // Arrange: the same two answers, read twice.
    const previous = buildSuperChats([]);
    const next = buildSuperChats([buildSuperChatOfFamiliaCarnauba()]);

    // Act: detect twice.
    const firstIds = detectNewSuperChats(previous, next, moment).map((event) => event.eventId);
    const secondIds = detectNewSuperChats(previous, next, moment).map((event) => event.eventId);

    // Assert: the same id, so the inbox lists it once.
    expect(secondIds, 'the event id must not depend on when it was detected').toEqual(firstIds);
  });
});

const firstPollScenarios: Array<{
  name: string;
  previous: SuperChatsShape | undefined;
  next: SuperChatsShape;
  expectedMessageIds: string[];
}> = [
  // Switched on for the first time: the last 15 minutes only, not the hour before.
  {
    name: 'a first poll lists the last 15 minutes and skips older history',
    previous: undefined,
    next: buildSuperChats([buildSuperChatOfAnaDoPaddock(), buildSuperChatOfTorcidaPequi()]),
    expectedMessageIds: ['mensagem-pequi-0001'],
  },
  // The window's edge: exactly 15 minutes old is still news.
  {
    name: 'a first poll keeps one published exactly 15 minutes before',
    previous: undefined,
    next: buildSuperChats([buildSuperChat('mensagem-borda-0004', 'Torcida Acauã', 15)]),
    expectedMessageIds: ['mensagem-borda-0004'],
  },
  // After a restart the saved answer is compared: one paid while the server was down fires.
  {
    name: 'after a restart, a Super Chat paid while the server was down fires',
    previous: buildSuperChats([buildSuperChatOfTorcidaPequi()]),
    next: buildSuperChats([buildSuperChatOfTorcidaPequi(), buildSuperChatOfFamiliaCarnauba()]),
    expectedMessageIds: ['mensagem-carnauba-0003'],
  },
  // The adapter reads more history afresh than the saved answer kept: older is old news.
  {
    name: 'after a restart, one older than the saved answer’s oldest does not fire',
    previous: buildSuperChats([buildSuperChatOfTorcidaPequi()]),
    next: buildSuperChats([buildSuperChatOfAnaDoPaddock(), buildSuperChatOfTorcidaPequi()]),
    expectedMessageIds: [],
  },
  // An empty answer saved an hour ago: everything paid since it is news, as on any poll,
  // even 40 minutes old (a long downtime); its own first-poll window reaches back 15 more.
  {
    name: 'after an empty answer, every one paid since it fires, however long ago',
    previous: { updatedAtMs: pollArrivedAtMs - 60 * 60_000, entries: [] },
    next: buildSuperChats([buildSuperChatOfAnaDoPaddock()]),
    expectedMessageIds: ['mensagem-paddock-0002'],
  },
  // An empty answer of a moment ago: like a first poll, older history is not news.
  {
    name: 'after an empty answer, one older than its 15-minute window does not fire',
    previous: buildSuperChats([]),
    next: buildSuperChats([buildSuperChatOfAnaDoPaddock()]),
    expectedMessageIds: [],
  },
];

describe('the first poll and the restart', () => {
  it.each(firstPollScenarios)('$name', ({ previous, next, expectedMessageIds }) => {
    // Arrange: the answers of the row.

    // Act: detect.
    const events = detectNewSuperChats(previous, next, moment);

    // Assert: exactly the row's Super Chats fire.
    const firedIds = events.map((event) => event.eventId.split(':superChat:')[1]);
    expect(firedIds, 'these Super Chats, and only these, must fire').toEqual(expectedMessageIds);
  });
});

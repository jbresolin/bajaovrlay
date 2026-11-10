/**
 * Which list a Super Chat goes in, on the "Eventos" tab and page (apps/control)
 *
 * What this module is for:
 *   inboxEventLists.ts splits the waiting events into two lists: the Super Chats no person
 *   has approved (with "Aprovar") and everything the operator may put on air (with "No ar").
 *   The server refuses "No ar" for any Super Chat whose status is not approved; the page
 *   uses that same rule (the follow-up to gate 2 of PR #54), so it never offers "No ar" on
 *   a Super Chat the server would refuse.
 *
 * What these tests prove, one row each:
 *   - A pending Super Chat is listed for approval only.
 *   - An approved Super Chat is listed for "No ar" only.
 *   - A queued Super Chat (the rule schema allows none today) is listed for approval, never
 *     for "No ar": only approved counts as approved.
 *   - A discarded Super Chat is in neither list.
 *
 * What these tests deliberately do not cover:
 *   - How the lists are drawn; WaitingEventsList and the Super Chat component tests.
 *   - What the server refuses; the server's superChatModerationOnTheStore.test.ts.
 */
import type { InboxEvent } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildApprovedSuperChatOfTorcidaCarnauba,
  buildSuperChatOfTorcidaPequiAwaitingApproval,
} from '@/state/superChatsLikeTheServerSends.testSupport';

import {
  listSuperChatsAwaitingApprovalNewestFirst,
  listWaitingEventsNewestFirst,
} from './inboxEventLists';

/** Torcida Pequi's Super Chat, ten minutes old, with its status set to `status`. */
function buildSuperChatOfTorcidaPequiWithStatus(status: InboxEvent['status']): InboxEvent {
  const superChat = buildSuperChatOfTorcidaPequiAwaitingApproval(10);
  return { ...superChat, status };
}

const listScenarios = [
  // The everyday case: just arrived, waiting for Dados.
  {
    name: 'lists a pending Super Chat for approval only',
    superChat: buildSuperChatOfTorcidaPequiWithStatus('pending'),
    isListedForApproval: true,
    isListedForOnAir: false,
  },
  // Dados approved it: now it waits for the Produtor's "No ar".
  {
    name: 'lists an approved Super Chat for "No ar" only',
    superChat: buildApprovedSuperChatOfTorcidaCarnauba(10),
    isListedForApproval: false,
    isListedForOnAir: true,
  },
  // Not reachable today, but it must match the server: anything but approved needs approval.
  {
    name: 'lists a queued Super Chat for approval, never for "No ar"',
    superChat: buildSuperChatOfTorcidaPequiWithStatus('queued'),
    isListedForApproval: true,
    isListedForOnAir: false,
  },
  // Discarded: it waits for nobody.
  {
    name: 'lists a discarded Super Chat in neither list',
    superChat: buildSuperChatOfTorcidaPequiWithStatus('dismissed'),
    isListedForApproval: false,
    isListedForOnAir: false,
  },
];

describe('the list a Super Chat goes in', () => {
  it.each(listScenarios)('$name', ({ superChat, isListedForApproval, isListedForOnAir }) => {
    // Arrange: the inbox holding only this Super Chat.
    const events = [superChat];

    // Act: build both lists.
    const awaitingApproval = listSuperChatsAwaitingApprovalNewestFirst(events);
    const waitingForOnAir = listWaitingEventsNewestFirst(events);

    // Assert: it is in the lists the server's rule puts it in, and no other.
    expect(
      awaitingApproval.includes(superChat),
      'in the approval list exactly when its status is not approved and it still waits',
    ).toBe(isListedForApproval);
    expect(waitingForOnAir.includes(superChat), 'offered "No ar" only once approved').toBe(
      isListedForOnAir,
    );
  });
});

/**
 * A viewer's Super Chat arrives in the inbox once, and waits (apps/server)
 *
 * What this module is for:
 *   The event detection watches every accepted poll; a source that answers the superChats
 *   shape (the YouTube source, or the simulator rehearsing one, BAJAOVRLAY-35) fills the
 *   inbox with its viewers' paid messages, each waiting for a person's approval.
 *
 * What these tests prove, through a real store on a temporary database:
 *   - The first poll of a source lists the Super Chats of its last 15 minutes, pending,
 *     and skips older ones.
 *   - A later poll lists only the Super Chats it adds.
 *   - After a restart, the same Super Chats read again are not listed twice, and one paid
 *     while the server was down is.
 *   - A Super Chat waits as pending even if its rule were changed by hand in the database:
 *     the schemas refuse "auto" for it, so it never reaches the runner.
 *
 * What these tests deliberately do not cover:
 *   - Which Super Chats are news between two answers, row by row; detectors/newSuperChat.test.ts.
 *   - Approving and airing them; superChatModerationOnTheStore.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  buildSuperChatOfAnaDoPaddock,
  buildSuperChatOfFamiliaCarnauba,
  buildSuperChatOfTorcidaPequi,
} from './detectors/superChatsOfTheChat.testSupport.js';
import {
  type EventInboxOnTheStore,
  openEventInboxOnTheStore,
  pollTheSimulator,
  restartTheServer,
} from './eventInboxOnTheStore.testSupport.js';

/** The ids and statuses of the inbox's Super Chats, oldest first. */
function listSuperChatsInTheInbox(inbox: EventInboxOnTheStore): string[] {
  return inbox.stateStore
    .readAllSlices()
    .events.filter((event) => event.kind === 'superChat')
    .map((event) => `${event.eventId} ${event.status}`);
}

/** The simulator answering these Super Chats, as of the store's clock. */
function pollSuperChats(
  inbox: EventInboxOnTheStore,
  entries: ReturnType<typeof buildSuperChatOfTorcidaPequi>[],
): void {
  const updatedAtMs = inbox.clock.readCurrentTime().getTime();
  pollTheSimulator(inbox, { superChats: { updatedAtMs, entries } });
}

/**
 * The Super Chats of the test support dated against the store's clock rather than the
 * detector tests' fixed poll moment: each keeps its "minutes before" from now.
 */
function moveToTheStoreClock<Entry extends { publishedAtMs: number }>(
  inbox: EventInboxOnTheStore,
  entry: Entry,
): Entry {
  const minutesBeforeInTheSupport = Date.parse('2027-08-14T15:00:00.000Z') - entry.publishedAtMs;
  return {
    ...entry,
    publishedAtMs: inbox.clock.readCurrentTime().getTime() - minutesBeforeInTheSupport,
  };
}

describe('the first poll of a source answering Super Chats', () => {
  it('lists the last 15 minutes, pending, and skips older ones', () => {
    // Arrange: the inbox with the simulator just turned on.
    const inbox = openEventInboxOnTheStore();

    // Act: its first poll lists Ana's (40 min ago) and Torcida Pequi's (2 min ago).
    pollSuperChats(inbox, [
      moveToTheStoreClock(inbox, buildSuperChatOfAnaDoPaddock()),
      moveToTheStoreClock(inbox, buildSuperChatOfTorcidaPequi()),
    ]);

    // Assert: only Torcida Pequi's is listed, waiting for approval.
    expect(listSuperChatsInTheInbox(inbox), 'only the last 15 minutes must arrive').toEqual([
      'simulador-enduro:superChat:mensagem-pequi-0001 pending',
    ]);
    inbox.shutDown();
  });

  it('lists only what a later poll adds', () => {
    // Arrange: a first poll with Torcida Pequi's.
    const inbox = openEventInboxOnTheStore();
    const torcidaPequi = moveToTheStoreClock(inbox, buildSuperChatOfTorcidaPequi());
    pollSuperChats(inbox, [torcidaPequi]);

    // Act: the next poll adds Família Carnaúba's.
    inbox.clock.letTimePass(30_000);
    pollSuperChats(inbox, [
      torcidaPequi,
      moveToTheStoreClock(inbox, buildSuperChatOfFamiliaCarnauba()),
    ]);

    // Assert: both listed once each.
    expect(listSuperChatsInTheInbox(inbox), 'each Super Chat must be listed once').toEqual([
      'simulador-enduro:superChat:mensagem-pequi-0001 pending',
      'simulador-enduro:superChat:mensagem-carnauba-0003 pending',
    ]);
    inbox.shutDown();
  });
});

describe('Super Chats across a restart', () => {
  it('lists nothing twice, and lists one paid while the server was down', () => {
    // Arrange: Torcida Pequi's listed, then the server stops for ten minutes.
    const inbox = openEventInboxOnTheStore();
    const torcidaPequi = moveToTheStoreClock(inbox, buildSuperChatOfTorcidaPequi());
    pollSuperChats(inbox, [torcidaPequi]);
    inbox.clock.letTimePass(10 * 60_000);
    const inboxAfterTheRestart = restartTheServer(inbox);

    // Act: the first poll after the restart reads Torcida Pequi's again and Família
    // Carnaúba's, paid while the server was down.
    pollSuperChats(inboxAfterTheRestart, [
      torcidaPequi,
      moveToTheStoreClock(inboxAfterTheRestart, buildSuperChatOfFamiliaCarnauba()),
    ]);

    // Assert: Torcida Pequi's still once, Família Carnaúba's added.
    expect(
      listSuperChatsInTheInbox(inboxAfterTheRestart),
      'a restart must neither repeat nor lose a Super Chat',
    ).toEqual([
      'simulador-enduro:superChat:mensagem-pequi-0001 pending',
      'simulador-enduro:superChat:mensagem-carnauba-0003 pending',
    ]);
    inboxAfterTheRestart.shutDown();
  });
});

describe('the rule of a Super Chat', () => {
  it('cannot be set to auto, so a Super Chat always waits', () => {
    // Arrange: the inbox, its Super Chat rule as seeded ("Perguntar").
    const inbox = openEventInboxOnTheStore();

    // Act: try to set it to auto.
    const outcome = inbox.stateStore.applyCommand(
      { type: 'updateEventRule', kind: 'superChat', mode: 'auto' },
      'produtor:Mesa 1',
    );
    pollSuperChats(inbox, [moveToTheStoreClock(inbox, buildSuperChatOfTorcidaPequi())]);

    // Assert: refused, and the Super Chat that arrives waits for a person.
    expect(outcome.ok, 'a Super Chat rule may never be auto').toBe(false);
    expect(listSuperChatsInTheInbox(inbox), 'it must wait for approval').toEqual([
      'simulador-enduro:superChat:mensagem-pequi-0001 pending',
    ]);
    inbox.shutDown();
  });
});

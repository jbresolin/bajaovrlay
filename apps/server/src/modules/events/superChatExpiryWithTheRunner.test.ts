/**
 * A Super Chat past its rule's maximum wait expires, approved or not (apps/server)
 *
 * What this module is for:
 *   The event runner expires every waiting event older than its rule's maxAgeMs, so the
 *   page shows it "expirou" instead of waiting for ever. A Super Chat (BAJAOVRLAY-35) waits
 *   twice: for a person's approval (pending), then for the Produtor's "No ar" (approved).
 *   Gate 2 of PR #54 asked that both count as waiting for the runner too.
 *
 * What these tests prove, one row each, through a real store and the runner on a clock
 * moved by hand:
 *   - A pending Super Chat past a 60 s maximum wait is expired, and nothing goes on air.
 *   - An approved one is expired the same way, and nothing goes on air.
 *
 * What these tests deliberately do not cover:
 *   - The runner's own rules for race events; eventRunner.test.ts.
 *   - Who may approve; superChatModerationOnTheStore.test.ts.
 */
import { describe, expect, it, onTestFinished } from 'vitest';

import { createLogger } from '../../core/logger/createLogger.js';
import { eventInboxActor } from '../../core/store/commandActors.js';
import {
  applyOrThrow,
  createClockItemForEvents,
  openEventInboxOnTheStore,
  readEvent,
} from './eventInboxOnTheStore.testSupport.js';
import { startEventRunner } from './eventRunner.js';

/** The id the inbox gives a fictional viewer's R$ 20,00 Super Chat. */
const superChatEventId = 'youtube-ao-vivo:superChat:mensagem-pequi-0001';

/**
 * The inbox with the runner on its clock, the Super Chat rule naming a clock item and
 * waiting 60 s at most, and Torcida Pequi's Super Chat recorded now, pending.
 */
function openInboxWithAPendingSuperChat() {
  const inbox = openEventInboxOnTheStore();
  const itemId = createClockItemForEvents(inbox.stateStore, 'Super Chat no relógio');
  applyOrThrow(inbox.stateStore, {
    type: 'updateEventRule',
    kind: 'superChat',
    itemId,
    maxAgeMs: 60_000,
  });
  const runner = startEventRunner({
    stateStore: inbox.stateStore,
    logger: createLogger({ level: 'silent' }),
    readCurrentTime: inbox.clock.readCurrentTime,
    startTimer: inbox.clock.startTimer,
    cancelTimer: inbox.clock.cancelTimer,
  });
  onTestFinished(() => {
    runner.stop();
    inbox.shutDown();
  });
  applyOrThrow(
    inbox.stateStore,
    {
      type: 'recordDetectedEvents',
      events: [
        {
          eventId: superChatEventId,
          kind: 'superChat',
          sourceId: 'youtube-ao-vivo',
          detectedAtMs: inbox.clock.readCurrentTime().getTime(),
          payload: {
            authorName: 'Torcida Pequi Off-Road',
            amountText: 'R$ 20,00',
            messageText: 'Vai, Pequi! Abraço de Goiânia',
          },
        },
      ],
    },
    eventInboxActor,
  );
  inbox.clock.runTheTimersDueNow();
  return inbox;
}

const expiryScenarios = [
  // Nobody approved it in time.
  { name: 'expires a pending Super Chat past its maximum wait', isApproved: false },
  // Dados approved it, but the Produtor never put it on air.
  { name: 'expires an approved Super Chat past its maximum wait', isApproved: true },
];

describe('a Super Chat that waited too long', () => {
  it.each(expiryScenarios)('$name', ({ isApproved }) => {
    // Arrange: the Super Chat pending, or approved by Dados.
    const inbox = openInboxWithAPendingSuperChat();
    if (isApproved) {
      applyOrThrow(
        inbox.stateStore,
        { type: 'approveEvent', eventId: superChatEventId },
        'dados:Mesa 2',
      );
    }

    // Act: let 61 s pass.
    inbox.clock.letTimePass(61_000);

    // Assert: expired, and nothing on the program output.
    expect(
      readEvent(inbox.stateStore, superChatEventId)?.status,
      'the page must show it expired',
    ).toBe('expired');
    const onProgram = inbox.stateStore
      .readAllSlices()
      .instances.filter((instance) => instance.target === 'program');
    expect(onProgram, 'expiring puts nothing on air').toEqual([]);
  });
});

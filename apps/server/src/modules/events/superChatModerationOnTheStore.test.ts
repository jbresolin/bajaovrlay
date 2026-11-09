/**
 * A viewer's Super Chat reaches the air only after a person approves it (apps/server)
 *
 * What this module is for:
 *   A Super Chat (BAJAOVRLAY-35) is text a viewer paid to write on the live chat. It
 *   arrives in the inbox pending. Dados, who reads the chat, approves or discards it (the
 *   Produtor may too, when alone at the desk); only an approved one may go on air, and only
 *   by the Produtor's "No ar" or "Tomar". Dados may discard a Super Chat and nothing else
 *   of the inbox.
 *
 * What these tests prove, through a real store on a temporary database:
 *   - Who may approve, discard and show a Super Chat, by role and by its status (one table
 *     row each), and that a race event can be neither approved nor discarded by Dados.
 *   - A pending Super Chat is refused on air ("Super Chat ainda não aprovado"), with "No ar"
 *     and with "Tomar" on its Prévia; once approved, the same Prévia goes on air.
 *   - A discarded Super Chat brought back with "Restaurar" waits for approval again.
 *   - Every approval and discard writes an event-log row naming who did it.
 *
 * What these tests deliberately do not cover:
 *   - How a Super Chat is detected; superChatDetectionOnTheStore.test.ts.
 *   - The buttons each role sees; the control page's tests.
 */
import { describe, expect, it } from 'vitest';

import { eventInboxActor } from '../../core/store/commandActors.js';
import type { CommandOutcome, StateStore } from '../../core/store/createStateStore.js';
import {
  applyOrThrow,
  createClockItemForEvents,
  openEventInboxOnTheStore,
  readEvent,
} from './eventInboxOnTheStore.testSupport.js';

/** The Produtor at the main desk, logged in with a PIN. */
const producerActor = 'produtor:Mesa 1';

/** Dados at the second desk, reading the chat. */
const dataRoleActor = 'dados:Mesa 2';

/** The id the inbox gives a fictional viewer's R$ 20,00 Super Chat. */
const superChatEventId = 'youtube-ao-vivo:superChat:mensagem-pequi-0001';

/** The id the inbox gives car 47's start penalty. */
const startPenaltyEventId = 'simulador-enduro:incident:ocorrencia-0007';

/**
 * Records a fictional viewer's Super Chat and car 47's start penalty, both pending, as the
 * detection would; and names a clock item as the Super Chat's item, so "No ar" has one.
 */
function startWithAPendingSuperChatAndPenalty(): StateStore {
  const inbox = openEventInboxOnTheStore();
  const stateStore = inbox.stateStore;
  const itemId = createClockItemForEvents(stateStore, 'Super Chat no relógio', {
    sessionName: { kind: 'eventField', path: 'authorName' },
  });
  applyOrThrow(stateStore, { type: 'updateEventRule', kind: 'superChat', itemId });
  const detectedAtMs = inbox.clock.readCurrentTime().getTime();
  applyOrThrow(
    stateStore,
    {
      type: 'recordDetectedEvents',
      events: [
        {
          eventId: superChatEventId,
          kind: 'superChat',
          sourceId: 'youtube-ao-vivo',
          detectedAtMs,
          payload: {
            authorName: 'Torcida Pequi Off-Road',
            amountText: 'R$ 20,00',
            messageText: 'Vai, Pequi! Abraço de Goiânia',
          },
        },
        {
          eventId: startPenaltyEventId,
          kind: 'newIncident',
          sourceId: 'simulador-enduro',
          detectedAtMs,
          payload: { carNumber: 47, reason: 'Queima de largada', penaltyText: '+30 segundos' },
        },
      ],
    },
    eventInboxActor,
  );
  return stateStore;
}

/** The Super Chat approved by the Produtor, from the start above. */
function startWithAnApprovedSuperChat(): StateStore {
  const stateStore = startWithAPendingSuperChatAndPenalty();
  applyOrThrow(stateStore, { type: 'approveEvent', eventId: superChatEventId }, producerActor);
  return stateStore;
}

type ModerationScenario = {
  name: string;
  startWith: () => StateStore;
  actor: string;
  command: { type: 'approveEvent' | 'dismissEvent' | 'showEvent'; eventId: string };
  /** The outcome's error code, or 'ok'. */
  expectedOutcome: string;
  /** The event's status after the command. */
  expectedStatus: string;
};

const moderationScenarios: ModerationScenario[] = [
  // Dados's own job: approving what it read on the chat.
  {
    name: 'Dados approves a pending Super Chat',
    startWith: startWithAPendingSuperChatAndPenalty,
    actor: dataRoleActor,
    command: { type: 'approveEvent', eventId: superChatEventId },
    expectedOutcome: 'ok',
    expectedStatus: 'approved',
  },
  // The Produtor alone at the desk does Dados's job too.
  {
    name: 'the Produtor approves a pending Super Chat',
    startWith: startWithAPendingSuperChatAndPenalty,
    actor: producerActor,
    command: { type: 'approveEvent', eventId: superChatEventId },
    expectedOutcome: 'ok',
    expectedStatus: 'approved',
  },
  // A second click (or a second desk) on one already approved changes nothing.
  {
    name: 'approving an approved Super Chat again is refused',
    startWith: startWithAnApprovedSuperChat,
    actor: dataRoleActor,
    command: { type: 'approveEvent', eventId: superChatEventId },
    expectedOutcome: 'EVENT_NOT_APPROVABLE',
    expectedStatus: 'approved',
  },
  // Approval is a Super Chat's step only: a penalty has nothing to approve.
  {
    name: 'approving a penalty is refused, even for the Produtor',
    startWith: startWithAPendingSuperChatAndPenalty,
    actor: producerActor,
    command: { type: 'approveEvent', eventId: startPenaltyEventId },
    expectedOutcome: 'EVENT_NOT_APPROVABLE',
    expectedStatus: 'pending',
  },
  // Dados says no to a message it read.
  {
    name: 'Dados discards a pending Super Chat',
    startWith: startWithAPendingSuperChatAndPenalty,
    actor: dataRoleActor,
    command: { type: 'dismissEvent', eventId: superChatEventId },
    expectedOutcome: 'ok',
    expectedStatus: 'dismissed',
  },
  // Dados changes its mind after approving.
  {
    name: 'Dados discards an approved Super Chat',
    startWith: startWithAnApprovedSuperChat,
    actor: dataRoleActor,
    command: { type: 'dismissEvent', eventId: superChatEventId },
    expectedOutcome: 'ok',
    expectedStatus: 'dismissed',
  },
  // The race's events stay the Produtor's: Dados may not discard a penalty.
  {
    name: 'Dados may not discard a penalty',
    startWith: startWithAPendingSuperChatAndPenalty,
    actor: dataRoleActor,
    command: { type: 'dismissEvent', eventId: startPenaltyEventId },
    expectedOutcome: 'NOT_ALLOWED',
    expectedStatus: 'pending',
  },
  // The Produtor decides not to air one Dados approved.
  {
    name: 'the Produtor discards an approved Super Chat',
    startWith: startWithAnApprovedSuperChat,
    actor: producerActor,
    command: { type: 'dismissEvent', eventId: superChatEventId },
    expectedOutcome: 'ok',
    expectedStatus: 'dismissed',
  },
  // Dados never changes the air, an approved Super Chat included.
  {
    name: 'Dados may not put an approved Super Chat on air',
    startWith: startWithAnApprovedSuperChat,
    actor: dataRoleActor,
    command: { type: 'showEvent', eventId: superChatEventId },
    expectedOutcome: 'NOT_ALLOWED',
    expectedStatus: 'approved',
  },
  // Nothing a viewer writes reaches the air without a person approving it.
  {
    name: 'the Produtor may not put a pending Super Chat on air',
    startWith: startWithAPendingSuperChatAndPenalty,
    actor: producerActor,
    command: { type: 'showEvent', eventId: superChatEventId },
    expectedOutcome: 'EVENT_NOT_APPROVED',
    expectedStatus: 'pending',
  },
  // The one way on air: approved, then the Produtor's "No ar".
  {
    name: 'the Produtor puts an approved Super Chat on air',
    startWith: startWithAnApprovedSuperChat,
    actor: producerActor,
    command: { type: 'showEvent', eventId: superChatEventId },
    expectedOutcome: 'ok',
    expectedStatus: 'onAir',
  },
];

/** 'ok', or the error code of a refused outcome. */
function readOutcomeCode(outcome: CommandOutcome): string {
  return outcome.ok ? 'ok' : outcome.error.code;
}

describe('who may approve, discard and show a Super Chat', () => {
  it.each(moderationScenarios)(
    '$name',
    ({ startWith, actor, command, expectedOutcome, expectedStatus }) => {
      // Arrange: the inbox in the state the row starts from.
      const stateStore = startWith();

      // Act: the row's actor sends the row's command.
      const outcome = stateStore.applyCommand(command, actor);

      // Assert: accepted or refused with the row's code, and the event left in the row's status.
      expect(readOutcomeCode(outcome), `${command.type} by ${actor}`).toBe(expectedOutcome);
      expect(
        readEvent(stateStore, command.eventId)?.status,
        'the event must be left in this status',
      ).toBe(expectedStatus);
    },
  );
});

describe('a pending Super Chat on air', () => {
  it('is refused with "No ar" in pt-BR, and nothing goes on air', () => {
    // Arrange: a pending Super Chat whose rule names an item.
    const stateStore = startWithAPendingSuperChatAndPenalty();

    // Act: the Produtor presses "No ar".
    const outcome = stateStore.applyCommand(
      { type: 'showEvent', eventId: superChatEventId },
      producerActor,
    );

    // Assert: refused with the reason the operator reads, and the program output is empty.
    expect(outcome, 'a Super Chat no one approved must never air').toEqual({
      ok: false,
      error: { code: 'EVENT_NOT_APPROVED', message: 'Super Chat ainda não aprovado' },
    });
    const onProgram = stateStore
      .readAllSlices()
      .instances.filter((instance) => instance.target === 'program');
    expect(onProgram, 'nothing may be on the program output').toEqual([]);
  });

  it('is refused with "Tomar" on its Prévia until approved, then airs', () => {
    // Arrange: the Produtor previews the pending Super Chat on its item.
    const stateStore = startWithAPendingSuperChatAndPenalty();
    const itemId = stateStore
      .readAllSlices()
      .eventRules.find((rule) => rule.kind === 'superChat')?.itemId;
    applyOrThrow(
      stateStore,
      { type: 'previewItem', itemId, eventId: superChatEventId },
      producerActor,
    );
    const clockLayerId = 'clock';

    // Act: "Tomar" before the approval, then Dados approves, then "Tomar" again.
    const takeBeforeApproval = stateStore.applyCommand(
      { type: 'takePreview', layerId: clockLayerId },
      producerActor,
    );
    applyOrThrow(stateStore, { type: 'approveEvent', eventId: superChatEventId }, dataRoleActor);
    const takeAfterApproval = stateStore.applyCommand(
      { type: 'takePreview', layerId: clockLayerId },
      producerActor,
    );

    // Assert: the first take is refused as not approved, the second airs the Super Chat.
    expect(readOutcomeCode(takeBeforeApproval), 'Tomar before the approval').toBe(
      'EVENT_NOT_APPROVED',
    );
    expect(readOutcomeCode(takeAfterApproval), 'Tomar after the approval').toBe('ok');
    expect(
      readEvent(stateStore, superChatEventId)?.status,
      'the approved Super Chat must be on air after the take',
    ).toBe('onAir');
  });
});

describe('a discarded Super Chat brought back', () => {
  it('waits for approval again', () => {
    // Arrange: Dados approved the Super Chat, then the Produtor discarded it.
    const stateStore = startWithAnApprovedSuperChat();
    applyOrThrow(stateStore, { type: 'dismissEvent', eventId: superChatEventId }, producerActor);

    // Act: the Produtor presses "Restaurar".
    applyOrThrow(stateStore, { type: 'restoreEvent', eventId: superChatEventId }, producerActor);

    // Assert: pending, so a person approves it again before it can air.
    expect(
      readEvent(stateStore, superChatEventId)?.status,
      'a restored Super Chat must not keep its old approval',
    ).toBe('pending');
  });
});

describe('the event log of the moderation', () => {
  it('names who approved and who discarded', () => {
    // Arrange: the pending Super Chat.
    const stateStore = startWithAPendingSuperChatAndPenalty();

    // Act: Dados approves it, then the Produtor discards it.
    applyOrThrow(stateStore, { type: 'approveEvent', eventId: superChatEventId }, dataRoleActor);
    applyOrThrow(stateStore, { type: 'dismissEvent', eventId: superChatEventId }, producerActor);

    // Assert: one row each, with the desk that sent it and the Super Chat's id.
    const moderationRows = stateStore
      .readAllSlices()
      .eventLog.filter((row) => row.command === 'approveEvent' || row.command === 'dismissEvent')
      .map((row) => ({ actor: row.actor, command: row.command, payload: row.payload }));
    expect(moderationRows, 'each moderation step must be logged with who did it').toEqual([
      {
        actor: dataRoleActor,
        command: 'approveEvent',
        payload: { type: 'approveEvent', eventId: superChatEventId },
      },
      {
        actor: producerActor,
        command: 'dismissEvent',
        payload: { type: 'dismissEvent', eventId: superChatEventId },
      },
    ]);
  });
});

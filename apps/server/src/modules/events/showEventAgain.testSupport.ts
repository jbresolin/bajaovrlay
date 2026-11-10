// Test support for "Mostrar de novo" (BAJAOVRLAY-67) through a real store: an inbox with
// one event of each kind waiting, and the ways to take one to shown or expired. Every
// function builds fresh objects on each call.
import { type EventPayloadPath } from '@bajaovrlay/shared';

import { eventInboxActor } from '../../core/store/commandActors.js';
import {
  applyOrThrow,
  createClockItemForEvents,
  type EventInboxOnTheStore,
  openEventInboxOnTheStore,
  typedEventId,
} from './eventInboxOnTheStore.testSupport.js';

/** The Produtor at the main desk, logged in with a PIN. */
export const producerActor = 'produtor:Mesa 1';

/** Dados at the second desk, reading the chat. */
export const dataRoleActor = 'dados:Mesa 2';

/** The id of each kind's event in these tests. */
export const eventIdOfKind: Record<'newIncident' | 'fastestLap' | 'manual' | 'superChat', string> =
  {
    newIncident: 'simulador-enduro:incident:ocorrencia-0007',
    fastestLap: 'simulador-enduro:fastestLap:31-29',
    manual: `manual:${typedEventId}`,
    superChat: 'youtube-ao-vivo:superChat:mensagem-pequi-0001',
  };

export type KindInTheseTests = keyof typeof eventIdOfKind;

/** The payload field each kind's item reads, one the kind's event carries. */
const pathReadByTheItemOfKind: Record<KindInTheseTests, EventPayloadPath> = {
  newIncident: 'teamName',
  fastestLap: 'teamName',
  manual: 'reason',
  superChat: 'authorName',
};

/**
 * An inbox with every rule asking, each with a clock item reading a field its event has,
 * no maximum wait, and one event of each kind waiting: car 47's start penalty, car 31's
 * fastest lap, a general notice typed in "+ Evento" and a fictional viewer's Super Chat.
 */
export function openInboxWithAnEventOfEachKind(): EventInboxOnTheStore {
  const inbox = openEventInboxOnTheStore();
  for (const kind of Object.keys(eventIdOfKind) as KindInTheseTests[]) {
    const itemId = createClockItemForEvents(inbox.stateStore, `Relógio — ${kind}`, {
      sessionName: { kind: 'eventField', path: pathReadByTheItemOfKind[kind] },
    });
    applyOrThrow(inbox.stateStore, {
      type: 'updateEventRule',
      kind,
      mode: 'ask',
      itemId,
      maxAgeMs: null,
    });
  }
  const detectedAtMs = inbox.clock.readCurrentTime().getTime();
  applyOrThrow(
    inbox.stateStore,
    {
      type: 'recordDetectedEvents',
      events: [
        {
          eventId: eventIdOfKind.newIncident,
          kind: 'newIncident',
          sourceId: 'simulador-enduro',
          detectedAtMs,
          payload: {
            carNumber: 47,
            teamName: 'Carnaúba Baja',
            noticeKind: 'penalty',
            reason: 'Queima de largada',
            penaltyText: '+30 segundos',
          },
        },
        {
          eventId: eventIdOfKind.fastestLap,
          kind: 'fastestLap',
          sourceId: 'simulador-enduro',
          detectedAtMs,
          payload: { carNumber: 31, teamName: 'Acauã Baja', lapNumber: 29, lapTimeText: '4:38,2' },
        },
        {
          eventId: eventIdOfKind.superChat,
          kind: 'superChat',
          sourceId: 'youtube-ao-vivo',
          detectedAtMs,
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
  applyOrThrow(inbox.stateStore, {
    type: 'createManualEvent',
    noticeKind: 'notice',
    reason: 'Largada adiada em 15 minutos',
  });
  return inbox;
}

/** The kind's event shown and off the air again: "No ar" (after "Aprovar"), then cleared. */
export function showAndClear(inbox: EventInboxOnTheStore, kind: KindInTheseTests): void {
  if (kind === 'superChat') {
    applyOrThrow(inbox.stateStore, { type: 'approveEvent', eventId: eventIdOfKind.superChat });
  }
  applyOrThrow(inbox.stateStore, { type: 'showEvent', eventId: eventIdOfKind[kind] });
  applyOrThrow(inbox.stateStore, { type: 'clearLayer', layerId: 'clock' });
}

/**
 * The kind's event expired: its rule given a one-minute wait, two minutes gone by, and
 * "No ar" pressed too late. A Super Chat is approved first when `isApprovedFirst`.
 */
export function letExpire(
  inbox: EventInboxOnTheStore,
  kind: KindInTheseTests,
  isApprovedFirst: boolean,
): void {
  applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind, maxAgeMs: 60_000 });
  if (isApprovedFirst) {
    applyOrThrow(inbox.stateStore, { type: 'approveEvent', eventId: eventIdOfKind[kind] });
  }
  inbox.clock.letTimePass(120_000);
  applyOrThrow(inbox.stateStore, { type: 'showEvent', eventId: eventIdOfKind[kind] });
}

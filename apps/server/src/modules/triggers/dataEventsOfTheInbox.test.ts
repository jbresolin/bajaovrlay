/**
 * What an inbox event is to the data-event triggers (apps/server, modules/triggers)
 *
 * What this module is for:
 *   A trigger "Quando: evento de dados" (BAJAOVRLAY-48) waits for a penalty, an incident, a
 *   fastest lap or a leader change. readTriggerDataEventOfInboxEvent decides, in one place,
 *   which of those an inbox event is, and the data the firing carries, with pt-BR keys and
 *   only what the event has. A notice typed by the operator that is not a penalty is none
 *   of the four, and since BAJAOVRLAY-67 such a notice may be about no car at all: a
 *   general notice ("Largada adiada em 15 minutos").
 *
 * What these tests prove, one row per kind of event:
 *   - A detected penalty, a typed penalty, a warning, a fastest lap and a leader change are
 *     read as their trigger kind, with `carro` and the rest of what they carry.
 *   - A typed notice about a car, and a general notice about no car, fire no trigger: no
 *     trigger kind waits for a notice, so a general notice cannot fire one, with or
 *     without `carro`.
 *   - A Super Chat fires no trigger.
 *
 * What these tests deliberately do not cover:
 *   - The firing itself, its interval and its macro; triggerFiring.test.ts.
 */
import type { DetectedEvent } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { readTriggerDataEventOfInboxEvent } from './dataEventsOfTheInbox.js';

/** An inbox event as detected or typed at 14:31:50 on the enduro day. */
function buildEvent(kind: DetectedEvent['kind'], payload: DetectedEvent['payload']): DetectedEvent {
  return {
    eventId: `evento-${kind}`,
    kind,
    sourceId: kind === 'manual' ? null : 'simulador-enduro',
    detectedAtMs: Date.parse('2027-08-14T14:31:50.000Z'),
    payload,
  };
}

const dataEventScenarios: Array<{
  name: string;
  event: DetectedEvent;
  expected: ReturnType<typeof readTriggerDataEventOfInboxEvent>;
}> = [
  // The race direction's penalty, detected in the source.
  {
    name: 'reads a detected penalty as a penalty, with its car',
    event: buildEvent('newIncident', {
      carNumber: 47,
      teamName: 'Carnaúba Baja',
      noticeKind: 'penalty',
      reason: 'Queima de largada',
      penaltyText: '+30 segundos',
    }),
    expected: {
      eventKind: 'penalty',
      data: {
        tipo: 'Penalidade',
        carro: 47,
        equipe: 'Carnaúba Baja',
        motivo: 'Queima de largada',
        punicao: '+30 segundos',
      },
    },
  },
  // The same penalty typed in "+ Evento" fires the same triggers.
  {
    name: 'reads a typed penalty as a penalty, with its car',
    event: buildEvent('manual', {
      carNumber: 47,
      noticeKind: 'penalty',
      reason: 'Reabastecimento com o motor ligado',
    }),
    expected: {
      eventKind: 'penalty',
      data: { tipo: 'Penalidade', carro: 47, motivo: 'Reabastecimento com o motor ligado' },
    },
  },
  // A warning is an incident that is not a penalty.
  {
    name: 'reads a warning as an incident',
    event: buildEvent('newIncident', {
      carNumber: 38,
      noticeKind: 'warning',
      reason: 'Bloqueio de ultrapassagem',
    }),
    expected: {
      eventKind: 'incident',
      data: { tipo: 'Incidente', carro: 38, motivo: 'Bloqueio de ultrapassagem' },
    },
  },
  // The fastest lap carries its lap and time.
  {
    name: 'reads a fastest lap with its lap and time',
    event: buildEvent('fastestLap', { carNumber: 31, lapNumber: 29, lapTimeText: '4:38,2' }),
    expected: {
      eventKind: 'fastestLap',
      data: { tipo: 'Volta mais rápida', carro: 31, volta: 29, tempo: '4:38,2' },
    },
  },
  // A typed notice about a car: no trigger kind waits for a notice.
  {
    name: 'fires nothing for a typed notice about a car',
    event: buildEvent('manual', {
      carNumber: 12,
      noticeKind: 'notice',
      reason: 'Carro parado na reta dos boxes',
    }),
    expected: undefined,
  },
  // A general notice (BAJAOVRLAY-67): no car, and no trigger either.
  {
    name: 'fires nothing for a general notice about no car',
    event: buildEvent('manual', { noticeKind: 'notice', reason: 'Largada adiada em 15 minutos' }),
    expected: undefined,
  },
  // A viewer's message is no race event.
  {
    name: 'fires nothing for a Super Chat',
    event: buildEvent('superChat', {
      authorName: 'Torcida Pequi Off-Road',
      amountText: 'R$ 20,00',
      messageText: 'Vai, Pequi!',
    }),
    expected: undefined,
  },
];

describe('an inbox event read as a data event', () => {
  it.each(dataEventScenarios)('$name', ({ event, expected }) => {
    // Arrange: the row's event, as the inbox holds it.

    // Act: read it as the triggers do.
    const dataEvent = readTriggerDataEventOfInboxEvent(event);

    // Assert: the trigger kind and data this row expects, or nothing.
    expect(dataEvent, 'the event must read as this data event, or as none').toEqual(expected);
  });
});

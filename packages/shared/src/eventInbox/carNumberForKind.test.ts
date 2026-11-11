/**
 * Which kinds of event must name a car (packages/shared)
 *
 * What this module is for:
 *   An event's payload says what a graphic needs to show it. Every race event is about one
 *   car, so its payload must carry the car's number; a viewer's Super Chat
 *   (BAJAOVRLAY-35) is about no car, and neither is a general notice typed in "+ Evento"
 *   ("Largada adiada em 15 minutos", BAJAOVRLAY-67). The rule is checked with the kind
 *   and the notice kind, in one named place (checkCarNumberForKind), by both the detected
 *   event's schema and the slice's.
 *
 * What these tests prove, one row per kind and notice kind:
 *   - Each race kind (incident, fastest lap, leader change) without a car is refused at
 *     `payload.carNumber`, with a pt-BR reason; so is a typed penalty, always given to a car.
 *   - A Super Chat without a car is accepted, and so is a typed notice (a general notice).
 *   - The slice's schema (an event with its status) holds the same rule.
 *
 * What these tests deliberately do not cover:
 *   - The other payload fields; eventFieldValue.test.ts and the detectors' tests cover them.
 */
import { describe, expect, it } from 'vitest';

import type { EventNoticeKind, InboxEventKind } from './inboxEvent.js';
import { DetectedEventSchema } from './inboxEvent.js';
import { InboxEventSchema } from './inboxEventsSlice.js';

/** An event of this kind detected on the simulator, about no car at all. */
function buildEventOfKindWithoutACar(kind: InboxEventKind, noticeKind?: EventNoticeKind) {
  return {
    eventId: `simulador-enduro:${kind}:sem-carro`,
    kind,
    sourceId: 'simulador-enduro',
    detectedAtMs: Date.parse('2026-10-09T14:31:50.000Z'),
    payload:
      noticeKind === undefined
        ? { reason: 'Largada adiada em 15 minutos' }
        : { reason: 'Largada adiada em 15 minutos', noticeKind },
  };
}

const kindScenarios: Array<{
  name: string;
  kind: InboxEventKind;
  noticeKind?: EventNoticeKind;
  isAccepted: boolean;
}> = [
  // A penalty is always about one car.
  { name: 'refuses an incident without a car', kind: 'newIncident', isAccepted: false },
  // A fastest lap was set by one car.
  { name: 'refuses a fastest lap without a car', kind: 'fastestLap', isAccepted: false },
  // The new leader is one car.
  { name: 'refuses a leader change without a car', kind: 'leaderChanged', isAccepted: false },
  // A typed penalty is always given to a car, even when typed in "+ Evento".
  {
    name: 'refuses a typed penalty without a car',
    kind: 'manual',
    noticeKind: 'penalty',
    isAccepted: false,
  },
  // A typed notice may be about the event itself: "Largada adiada em 15 minutos".
  {
    name: 'accepts a typed notice without a car, a general notice',
    kind: 'manual',
    noticeKind: 'notice',
    isAccepted: true,
  },
  // A viewer's message is about no car.
  { name: 'accepts a Super Chat without a car', kind: 'superChat', isAccepted: true },
];

describe('the car of a detected event, by kind', () => {
  it.each(kindScenarios)('$name', ({ kind, noticeKind, isAccepted }) => {
    // Arrange: an event of this kind (and notice kind) with no car number.
    const event = buildEventOfKindWithoutACar(kind, noticeKind);

    // Act: check it as a detected event.
    const result = DetectedEventSchema.safeParse(event);

    // Assert: accepted only for a Super Chat, refused at the car otherwise.
    expect(result.success, `a ${kind} without a car: accepted or not`).toBe(isAccepted);
    if (!isAccepted) {
      expect(result.error?.issues[0]?.path, 'the refusal must point at the car').toEqual([
        'payload',
        'carNumber',
      ]);
      expect(result.error?.issues[0]?.message, 'the reason must be the pt-BR one').toBe(
        'Falta o número do carro: só um Super Chat ou um aviso geral vem sem carro.',
      );
    }
  });
});

describe('the car of an event in the slice', () => {
  it('holds the same rule once the event has a status', () => {
    // Arrange: a pending incident and a pending Super Chat, neither with a car.
    const statusFields = {
      status: 'pending',
      statusChanges: [{ status: 'pending', atMs: Date.parse('2026-10-09T14:31:50.000Z') }],
    };
    const incident = { ...buildEventOfKindWithoutACar('newIncident'), ...statusFields };
    const superChat = { ...buildEventOfKindWithoutACar('superChat'), ...statusFields };

    // Act: check both against the slice's schema.
    const incidentResult = InboxEventSchema.safeParse(incident);
    const superChatResult = InboxEventSchema.safeParse(superChat);

    // Assert: the incident is refused, the Super Chat kept.
    expect(incidentResult.success, 'an incident without a car must be refused').toBe(false);
    expect(superChatResult.success, 'a Super Chat without a car must be kept').toBe(true);
  });
});

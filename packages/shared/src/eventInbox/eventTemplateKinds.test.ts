/**
 * Which templates suit which kind of event (packages/shared)
 *
 * What this module is for:
 *   "Regras" shows each kind's template and lets the operator swap it ("Trocar") or make a
 *   new one ("+ Novo modelo", BAJAOVRLAY-67). A template suits a kind when every field it
 *   reads from the event is one that kind's events carry: a Super Chat template reads the
 *   viewer, which a penalty never has. A new template starts with each graphic field that
 *   has the name of one of the kind's payload fields, and whose type fits it, already read
 *   from the event.
 *
 * What these tests prove:
 *   - The payload fields of each kind, as its detector (or "+ Evento") fills them.
 *   - Table-driven: the seeded "Penalidade" suits incidents and typed events, not fastest
 *     laps; "Volta mais rápida" suits fastest laps only; "Super Chat" Super Chats only; an
 *     item no event fills suits no kind.
 *   - A new penalty template on the notice graphic reads the car, team, school, kind of
 *     notice, reason and penalty from the event, and leaves the variant and lap time alone.
 *
 * What these tests deliberately do not cover:
 *   - Whether a payload field fits a graphic field; eventFieldValue.test.ts.
 *   - Regras on the page; the control page's EventRulesTemplates.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import type { ItemFields } from '../rundown/fieldValue.js';
import {
  buildEventFieldsOfANewTemplate,
  doesTemplateSuitKind,
  listEventPayloadPathsOfKind,
} from './eventTemplateKinds.js';
import type { InboxEventKind } from './inboxEvent.js';

/** The notice graphic's data schema, as its manifest declares it (the fields that matter). */
function buildNoticeDataSchema(): unknown {
  return {
    type: 'object',
    properties: {
      variant: { type: 'string', enum: ['fastestLap', 'penalty'] },
      carNumber: { type: 'integer', minimum: 1 },
      teamName: { type: 'string' },
      schoolName: { type: 'string' },
      lapNumber: { type: 'integer', minimum: 1 },
      lapTimeText: { type: 'string' },
      noticeKind: { type: 'string', enum: ['penalty', 'warning', 'incident', 'notice'] },
      reason: { type: 'string' },
      penaltyText: { type: 'string' },
    },
    required: ['variant'],
  };
}

/** The seeded "Penalidade" fields. */
function buildPenaltyTemplateFields(): ItemFields {
  return {
    variant: { kind: 'literal', value: 'penalty' },
    noticeKind: { kind: 'eventField', path: 'noticeKind' },
    carNumber: { kind: 'eventField', path: 'carNumber' },
    teamName: { kind: 'eventField', path: 'teamName' },
    reason: { kind: 'eventField', path: 'reason' },
    penaltyText: { kind: 'eventField', path: 'penaltyText' },
  };
}

/** The seeded "Volta mais rápida" fields. */
function buildFastestLapTemplateFields(): ItemFields {
  return {
    variant: { kind: 'literal', value: 'fastestLap' },
    carNumber: { kind: 'eventField', path: 'carNumber' },
    lapNumber: { kind: 'eventField', path: 'lapNumber' },
    lapTimeText: { kind: 'eventField', path: 'lapTimeText' },
  };
}

/** The seeded "Super Chat" fields. */
function buildSuperChatTemplateFields(): ItemFields {
  return {
    amountText: { kind: 'eventField', path: 'amountText' },
    authorName: { kind: 'eventField', path: 'authorName' },
    messageText: { kind: 'eventField', path: 'messageText' },
  };
}

describe('the payload fields of each kind', () => {
  const kindScenarios: Array<{ kind: InboxEventKind; expected: string[] }> = [
    // newIncident.ts: the car, the incident's kind, reason, penalty and lap.
    {
      kind: 'newIncident',
      expected: [
        'carNumber',
        'teamName',
        'schoolName',
        'noticeKind',
        'reason',
        'penaltyText',
        'lapNumber',
      ],
    },
    // newFastestLap.ts: the car, the lap and its time in both forms.
    {
      kind: 'fastestLap',
      expected: ['carNumber', 'teamName', 'schoolName', 'lapNumber', 'lapTimeMs', 'lapTimeText'],
    },
    // leaderChanged.ts: the new leader and its lap.
    { kind: 'leaderChanged', expected: ['carNumber', 'teamName', 'schoolName', 'lapNumber'] },
    // "+ Evento": the car (or none), the kind of notice, the reason and the penalty.
    {
      kind: 'manual',
      expected: ['carNumber', 'teamName', 'schoolName', 'noticeKind', 'reason', 'penaltyText'],
    },
    // A viewer's message: no car.
    { kind: 'superChat', expected: ['authorName', 'amountText', 'messageText'] },
  ];

  it.each(kindScenarios)('lists what a $kind event carries', ({ kind, expected }) => {
    // Arrange: the kind comes from the row.

    // Act: list its payload fields.
    const paths = listEventPayloadPathsOfKind(kind);

    // Assert: exactly what its detector fills.
    expect(paths, `the fields a ${kind} event carries`).toEqual(expected);
  });
});

describe('whether a template suits a kind', () => {
  const suitScenarios: Array<{
    name: string;
    fields: ItemFields;
    kind: InboxEventKind;
    isSuited: boolean;
  }> = [
    // The seeded pairing of the incidents' rule.
    {
      name: '"Penalidade" suits incidents',
      fields: buildPenaltyTemplateFields(),
      kind: 'newIncident',
      isSuited: true,
    },
    // The seeded pairing of the typed events' rule.
    {
      name: '"Penalidade" suits typed events',
      fields: buildPenaltyTemplateFields(),
      kind: 'manual',
      isSuited: true,
    },
    // A fastest lap has no reason or penalty to show.
    {
      name: '"Penalidade" does not suit fastest laps',
      fields: buildPenaltyTemplateFields(),
      kind: 'fastestLap',
      isSuited: false,
    },
    // The seeded pairing of the fastest laps' rule.
    {
      name: '"Volta mais rápida" suits fastest laps',
      fields: buildFastestLapTemplateFields(),
      kind: 'fastestLap',
      isSuited: true,
    },
    // A penalty carries no lap time.
    {
      name: '"Volta mais rápida" does not suit incidents',
      fields: buildFastestLapTemplateFields(),
      kind: 'newIncident',
      isSuited: false,
    },
    // A viewer's message suits only Super Chats.
    {
      name: '"Super Chat" suits Super Chats',
      fields: buildSuperChatTemplateFields(),
      kind: 'superChat',
      isSuited: true,
    },
    // ...and no race event, which has no viewer.
    {
      name: '"Super Chat" does not suit typed events',
      fields: buildSuperChatTemplateFields(),
      kind: 'manual',
      isSuited: false,
    },
    // An item no event fills is no template at all.
    {
      name: 'an item no event fills suits no kind',
      fields: {
        variant: { kind: 'literal', value: 'penalty' },
        carNumber: { kind: 'literal', value: 47 },
      },
      kind: 'newIncident',
      isSuited: false,
    },
  ];

  it.each(suitScenarios)('$name', ({ fields, kind, isSuited }) => {
    // Arrange: the template's fields and the kind come from the row.

    // Act: ask whether it suits the kind.
    const answer = doesTemplateSuitKind(fields, kind);

    // Assert: the row's answer.
    expect(answer, 'a template suits a kind whose events carry all it reads').toBe(isSuited);
  });
});

describe('the fields of a new template', () => {
  it('reads each notice field named like a penalty payload field from the event', () => {
    // Arrange: the notice graphic's data schema.
    const dataSchema = buildNoticeDataSchema();

    // Act: start a new template of the incidents' rule on it.
    const fields = buildEventFieldsOfANewTemplate(dataSchema, 'newIncident');

    // Assert: every field an incident carries, by the same name and a fitting type; the
    // variant (no payload field) and the lap time (no incident has one) stay out.
    expect(fields, 'the event fields a new penalty template starts with').toEqual({
      carNumber: { kind: 'eventField', path: 'carNumber' },
      teamName: { kind: 'eventField', path: 'teamName' },
      schoolName: { kind: 'eventField', path: 'schoolName' },
      lapNumber: { kind: 'eventField', path: 'lapNumber' },
      noticeKind: { kind: 'eventField', path: 'noticeKind' },
      reason: { kind: 'eventField', path: 'reason' },
      penaltyText: { kind: 'eventField', path: 'penaltyText' },
    });
  });
});

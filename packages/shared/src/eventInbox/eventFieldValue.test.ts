/**
 * Item fields filled by an event (packages/shared)
 *
 * What this module is for:
 *   An item that shows events (the notice for penalties or fastest laps) does not hold
 *   its car, team or reason: each such field is an `eventField` naming a field of the
 *   event's payload (BAJAOVRLAY-44). The item editor offers "Evento" on a field only
 *   where some payload field fits it, by the same type rule as a binding's, and the
 *   server refuses a save that does not fit. At the show, the field reads the payload.
 *   An item with any such field is a template: it never goes on air by a take of its own.
 *
 * What these tests prove:
 *   - The nine payload paths are listed with their pt-BR labels and types.
 *   - A text field is offered the six text paths, an integer field the three integer
 *     ones, and a switch none: "Evento" is not offered there.
 *   - A text path on an integer field is a problem, worded in pt-BR; a fitting one is not.
 *   - A field reads its value from the payload, and nothing when the event lacks it.
 *   - An item is a template exactly when one of its fields is an event field.
 *   - The schema refuses a path that is not a payload field, and a value beside the kind.
 *   - Each kind's sample event passes the payload schema.
 *
 * What these tests deliberately do not cover:
 *   - The resolution at the show and the refused take; the server's eventFieldsOnTheStore.
 *   - The editor's controls; the control page's tests.
 */
import { describe, expect, it } from 'vitest';

import {
  EventFieldValueSchema,
  findProblemInEventFieldForField,
  isItemFilledByAnEvent,
  listEventPayloadPaths,
  listEventPayloadPathsThatFitField,
  readEventFieldFromPayload,
} from './eventFieldValue.js';
import { InboxEventKindSchema, InboxEventPayloadSchema } from './inboxEvent.js';
import { readSampleEventPayload } from './sampleEventPayloads.js';

/** A notice's data schema, as its manifest would declare it. */
const noticeDataSchema = {
  type: 'object',
  required: ['variant', 'carNumber'],
  properties: {
    variant: { type: 'string', enum: ['fastestLap', 'penalty'] },
    carNumber: { type: 'integer', title: 'Carro' },
    teamName: { type: 'string', title: 'Equipe' },
    lapNumber: { type: 'integer', title: 'Volta' },
    isHighlighted: { type: 'boolean', title: 'Destaque' },
  },
};

describe('the payload paths of an event field', () => {
  it('lists the nine paths with their labels and types', () => {
    // Arrange: nothing; the list is fixed in code.

    // Act: list them.
    const paths = listEventPayloadPaths();

    // Assert: exactly these, in this order.
    expect(paths, 'the payload paths must be this fixed list').toEqual([
      { path: 'carNumber', label: 'Carro', valueType: 'integer' },
      { path: 'teamName', label: 'Equipe', valueType: 'text' },
      { path: 'schoolName', label: 'Escola', valueType: 'text' },
      { path: 'noticeKind', label: 'Tipo de aviso', valueType: 'text' },
      { path: 'reason', label: 'Motivo', valueType: 'text' },
      { path: 'penaltyText', label: 'Punição', valueType: 'text' },
      { path: 'lapNumber', label: 'Volta', valueType: 'integer' },
      { path: 'lapTimeMs', label: 'Tempo da volta (ms)', valueType: 'integer' },
      { path: 'lapTimeText', label: 'Tempo da volta (texto)', valueType: 'text' },
    ]);
  });

  const fitScenarios = [
    // The team's name is text: every text path may fill it.
    {
      name: 'offers the six text paths to a text field',
      fieldKey: 'teamName',
      expectedPaths: [
        'teamName',
        'schoolName',
        'noticeKind',
        'reason',
        'penaltyText',
        'lapTimeText',
      ],
    },
    // The lap is a whole number: the car, the lap and the lap time in ms.
    {
      name: 'offers the three integer paths to an integer field',
      fieldKey: 'lapNumber',
      expectedPaths: ['carNumber', 'lapNumber', 'lapTimeMs'],
    },
    // No payload field is a yes or a no, so "Evento" is not offered on a switch.
    { name: 'offers nothing to a switch', fieldKey: 'isHighlighted', expectedPaths: [] },
  ];

  it.each(fitScenarios)('$name', ({ fieldKey, expectedPaths }) => {
    // Arrange: the notice's schema and this row's field.

    // Act: list the paths that fit.
    const paths = listEventPayloadPathsThatFitField(noticeDataSchema, fieldKey);

    // Assert: exactly this row's paths.
    expect(
      paths.map((choice) => choice.path),
      'only the paths whose type fits may be offered',
    ).toEqual(expectedPaths);
  });

  it('calls a text path on an integer field a problem, in pt-BR, and a fitting one none', () => {
    // Arrange: the reason on the lap, and the lap on the lap.
    const reasonOnTheLap = { kind: 'eventField' as const, path: 'reason' as const };
    const lapOnTheLap = { kind: 'eventField' as const, path: 'lapNumber' as const };

    // Act: check both.
    const problemOfTheReason = findProblemInEventFieldForField(
      reasonOnTheLap,
      noticeDataSchema,
      'lapNumber',
    );
    const problemOfTheLap = findProblemInEventFieldForField(
      lapOnTheLap,
      noticeDataSchema,
      'lapNumber',
    );

    // Assert: the reason does not fit and says so; the lap fits.
    expect(problemOfTheReason, 'a text cannot fill a whole number').toBe(
      'o campo do evento "Motivo" não cabe neste campo do gráfico.',
    );
    expect(problemOfTheLap, 'a lap fits a lap').toBe(undefined);
  });
});

describe('reading an event field', () => {
  it("reads the payload's value, and nothing when the event lacks it", () => {
    // Arrange: a warning, which carries no penalty.
    const warning = {
      carNumber: 81,
      teamName: 'Sucuri Racing',
      noticeKind: 'warning' as const,
      reason: 'Bloqueio de ultrapassagem',
    };

    // Act: read its team and its penalty.
    const team = readEventFieldFromPayload({ kind: 'eventField', path: 'teamName' }, warning);
    const penalty = readEventFieldFromPayload({ kind: 'eventField', path: 'penaltyText' }, warning);

    // Assert: the team, and nothing for the penalty.
    expect(team, 'the team must be read from the payload').toBe('Sucuri Racing');
    expect(penalty, 'a field the event lacks reads nothing').toBe(undefined);
  });

  it('calls an item a template exactly when one of its fields is an event field', () => {
    // Arrange: the "Penalização" item's fields, and a lower third's.
    const penaltyItemFields = {
      variant: { kind: 'literal' as const, value: 'penalty' },
      carNumber: { kind: 'eventField' as const, path: 'carNumber' as const },
    };
    const lowerThirdFields = { name: { kind: 'literal' as const, value: 'Ana Souza' } };

    // Act: ask both.
    const isPenaltyItemATemplate = isItemFilledByAnEvent(penaltyItemFields);
    const isLowerThirdATemplate = isItemFilledByAnEvent(lowerThirdFields);

    // Assert: only the penalty item.
    expect(isPenaltyItemATemplate, 'an item with an event field is a template').toBe(true);
    expect(isLowerThirdATemplate, 'an item of typed values is not').toBe(false);
  });
});

describe('EventFieldValueSchema', () => {
  const refusedScenarios = [
    // Only the payload's own fields can be read; a misspelt one would read nothing.
    {
      name: 'refuses a path that is not a payload field',
      fieldValue: { kind: 'eventField', path: 'team' },
    },
    // Strict like takeTime: a value written beside it would be believed and never used.
    {
      name: 'refuses a value written beside the kind',
      fieldValue: { kind: 'eventField', path: 'teamName', value: 'Carnaúba Baja' },
    },
  ];

  it.each(refusedScenarios)('$name', ({ fieldValue }) => {
    // Arrange: this row's field value.

    // Act: check it.
    const result = EventFieldValueSchema.safeParse(fieldValue);

    // Assert: refused.
    expect(result.success, 'the field value must be refused').toBe(false);
  });
});

describe('the sample events', () => {
  it.each(InboxEventKindSchema.options)('gives a valid sample for %s', (kind) => {
    // Arrange: this kind.

    // Act: read its sample and check it against the payload schema.
    const result = InboxEventPayloadSchema.safeParse(readSampleEventPayload(kind));

    // Assert: valid, so Prévia never fails on its own sample.
    expect(result.success, `the ${kind} sample must be a valid payload`).toBe(true);
  });
});

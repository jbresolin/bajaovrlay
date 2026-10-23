/**
 * The incidents shape (packages/shared)
 *
 * What this module is for:
 *   The race direction gives penalties and warnings and records incidents (a rollover, a
 *   car stopped on track). The incidents shape is how any source hands them to BajaOvrLay
 *   (BAJAOVRLAY-44): the session, when the list was produced, and one entry per incident
 *   with a stable id from the source, the car (number, team, school, as every shape
 *   repeats them), its kind (penalty, warning or incident), the reason in pt-BR, and
 *   optionally the penalty itself ("+30 segundos", "Volta cancelada"), the lap and the
 *   moment. The event inbox watches this list: an incident id it has not seen is a new
 *   event (modules/events).
 *
 * What these tests prove:
 *   - The sample (four incidents of the 2027 enduro) passes, unchanged.
 *   - An empty list passes: a race with no incident yet is the common case.
 *   - Each rule refuses a payload with the exact pt-BR sentence the operator reads on
 *     the "Fontes de dados" page: a kind outside the three, an empty reason, a missing
 *     id, the same id twice (the inbox would show one penalty as two, or hide one), a
 *     lap 0 and a placeholder empty penalty.
 *
 * What these tests deliberately do not cover:
 *   - Where the incidents come from (the simulator's simulatedIncidents.test.ts, a flex
 *     mapping in flexMapping) and how they become events (the detectors' tests).
 *   - The order of the entries: the shape keeps the order the source sends and sets no
 *     rule on it, because the inbox orders events by when they were detected.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { validateDataShape } from './validateDataShape.js';

/** The incidents sample as plain JSON: entries that can be changed one by one. */
type IncidentsSamplePayload = { entries: Array<Record<string, unknown>> } & Record<string, unknown>;

/** Reads the incidents sample afresh, so each test can break one thing in its own copy. */
function readIncidentsSample(): IncidentsSamplePayload {
  const sampleUrl = new URL('./samples/incidents.enduro.json', import.meta.url);
  return JSON.parse(readFileSync(sampleUrl, 'utf8')) as IncidentsSamplePayload;
}

describe('validateDataShape for incidents', () => {
  it('accepts the sample of four incidents and keeps every field', () => {
    // Arrange: the sample, a penalty, a warning, an incident with no moment and a
    // cancelled lap.
    const incidents = readIncidentsSample();

    // Act: validate it as incidents.
    const validation = validateDataShape('incidents', incidents);

    // Assert: valid, and the parsed shape is the payload itself.
    expect(validation, 'the sample must pass the incidents shape unchanged').toEqual({
      isValid: true,
      shape: incidents,
    });
  });

  it('accepts a session with no incident yet', () => {
    // Arrange: the sample's session with an empty list, as at the green flag.
    const incidents = { ...readIncidentsSample(), entries: [] };

    // Act: validate it as incidents.
    const validation = validateDataShape('incidents', incidents);

    // Assert: valid; nothing happened yet, which is not a mistake.
    expect(validation, 'an empty list of incidents must be accepted').toEqual({
      isValid: true,
      shape: incidents,
    });
  });

  const refusedEntryScenarios = [
    // The inbox and the notice know three kinds; a fourth would have no look on air.
    {
      name: 'refuses a kind that is not penalty, warning or incident',
      changeOfFirstEntry: { kind: 'disqualification' },
      expectedErrorMessage:
        'Dados inválidos em "incidents.entries.0.kind": valor fora da lista permitida.',
    },
    // A notice with no reason says nothing; an empty text is a placeholder, not a reason.
    {
      name: 'refuses an empty reason',
      changeOfFirstEntry: { reason: '' },
      expectedErrorMessage:
        'Dados inválidos em "incidents.entries.0.reason": valor abaixo do mínimo.',
    },
    // Without its id an incident cannot be told apart from the next one with the same car.
    {
      name: 'refuses an incident without its id',
      changeOfFirstEntry: { incidentId: undefined },
      expectedErrorMessage:
        'Dados inválidos em "incidents.entries.0.incidentId": campo ausente ou de tipo errado.',
    },
    // Laps are counted from 1: a penalty "on lap 0" is a placeholder for "unknown".
    {
      name: 'refuses lap 0',
      changeOfFirstEntry: { lap: 0 },
      expectedErrorMessage: 'Dados inválidos em "incidents.entries.0.lap": valor abaixo do mínimo.',
    },
    // An empty penalty would draw an empty navy cell on the notice; leave the field out.
    {
      name: 'refuses an empty penalty text',
      changeOfFirstEntry: { penaltyText: '' },
      expectedErrorMessage:
        'Dados inválidos em "incidents.entries.0.penaltyText": valor abaixo do mínimo.',
    },
  ];

  it.each(refusedEntryScenarios)('$name', ({ changeOfFirstEntry, expectedErrorMessage }) => {
    // Arrange: the sample with this row's mistake in its first incident, car 47's penalty.
    const incidents = readIncidentsSample();
    incidents.entries[0] = { ...incidents.entries[0], ...changeOfFirstEntry };

    // Act: validate it as incidents.
    const validation = validateDataShape('incidents', incidents);

    // Assert: refused, naming the first incident's field and this row's reason.
    expect(validation, 'the mistake must be refused at the path of that field').toEqual({
      isValid: false,
      errorMessage: expectedErrorMessage,
    });
  });

  it('refuses the same incident id twice, naming the second one', () => {
    // Arrange: the sample with its last incident given the id of the first.
    const incidents = readIncidentsSample();
    incidents.entries[3] = { ...incidents.entries[3], incidentId: 'ocorrencia-0007' };

    // Act: validate it as incidents.
    const validation = validateDataShape('incidents', incidents);

    // Assert: refused at the repeated id, because the inbox keys events by it and would
    // either show one penalty twice or never show the second one.
    expect(validation, 'an incident id listed twice must be refused at its repeat').toEqual({
      isValid: false,
      errorMessage:
        'Dados inválidos em "incidents.entries.3.incidentId": a ocorrência ocorrencia-0007 aparece mais de uma vez.',
    });
  });
});

/**
 * Resolving an item's field values into graphic data (apps/server)
 *
 * What this module is for:
 *   An item stores, for each field of its graphic, how the field gets its value. At
 *   the take, `resolveItemFieldsIntoGraphicData` turns those into the plain data the
 *   graphic receives. Today the only kind of field value is `literal` (typed by the
 *   operator, used as typed); M2 (BAJAOVRLAY-20) adds values read from data sources.
 *
 * What these tests prove:
 *   - Literal values of every JSON type pass through unchanged, under the same key.
 *   - An item with no fields resolves to empty data.
 *   - A field value of a kind the server does not know yet refuses the whole
 *     resolution (no half-filled data) with a pt-BR message that names M2.
 *   - The fields given are not changed.
 *
 * What these tests deliberately do not cover:
 *   - Whether the resolved data suits the graphic; the take checks that.
 */
import type { ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { resolveItemFieldsIntoGraphicData } from './resolveItemFields.js';

const literalScenarios: Array<{
  name: string;
  fields: ItemFields;
  expectedData: Record<string, unknown>;
}> = [
  // The race clock as an operator prepares it: text, numbers and a yes/no together.
  {
    name: 'maps the race clock fields of the enduro to plain data',
    fields: {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: 'green' },
      clockMode: { kind: 'literal', value: 'elapsed' },
      referenceTimeMs: { kind: 'literal', value: 3_900_000 },
      referenceWallClockMs: { kind: 'literal', value: 1_791_550_800_000 },
      running: { kind: 'literal', value: true },
    },
    expectedData: {
      sessionName: 'Enduro de Resistência',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 3_900_000,
      referenceWallClockMs: 1_791_550_800_000,
      running: true,
    },
  },
  // Values that are easy to lose by accident: zero, false, an empty text and null all
  // count as values and must reach the graphic as they are.
  {
    name: 'keeps zero, false, an empty text and null as they are',
    fields: {
      lapsCompletedByLeader: { kind: 'literal', value: 0 },
      running: { kind: 'literal', value: false },
      sponsorName: { kind: 'literal', value: '' },
      penaltyNote: { kind: 'literal', value: null },
    },
    expectedData: {
      lapsCompletedByLeader: 0,
      running: false,
      sponsorName: '',
      penaltyNote: null,
    },
  },
  // A literal may hold a list or an object, for graphics such as a podium.
  {
    name: 'passes a list and an object through whole',
    fields: {
      podiumTeams: { kind: 'literal', value: ['Baja UFPR', 'Baja Poli USP', 'Baja UFMG'] },
      winner: { kind: 'literal', value: { teamNumber: 42, teamName: 'Baja UFPR' } },
    },
    expectedData: {
      podiumTeams: ['Baja UFPR', 'Baja Poli USP', 'Baja UFMG'],
      winner: { teamNumber: 42, teamName: 'Baja UFPR' },
    },
  },
  // An item of a graphic with no fields at all, such as a fixed logo.
  {
    name: 'resolves an item with no fields to empty data',
    fields: {},
    expectedData: {},
  },
];

describe('resolveItemFieldsIntoGraphicData with literal values', () => {
  it.each(literalScenarios)('$name', ({ fields, expectedData }) => {
    // Arrange: the fields of this scenario, and a copy to compare against afterwards.
    const copyOfFieldsBefore = structuredClone(fields);

    // Act: resolve them.
    const resolution = resolveItemFieldsIntoGraphicData(fields);

    // Assert: resolved to the expected data, and the fields are as they were.
    expect(resolution, 'every literal must reach the data unchanged, under its key').toEqual({
      status: 'resolved',
      data: expectedData,
    });
    expect(fields, 'resolving must not change the fields it was given').toEqual(copyOfFieldsBefore);
  });
});

describe('resolveItemFieldsIntoGraphicData with a kind it does not know', () => {
  it('refuses the whole resolution with a message that names M2', () => {
    // Arrange: a clock whose flag is bound to the timing system, which only M2 will
    // understand. Today's types allow only literals, so the test has to force it in.
    const fieldsWithBinding = {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'binding', sourceId: 'cronometragem', path: 'session.flag' },
    } as unknown as ItemFields;

    // Act: resolve them.
    const resolution = resolveItemFieldsIntoGraphicData(fieldsWithBinding);

    // Assert: refused as a whole, naming the field, its kind and M2.
    expect(resolution, 'an unknown kind must refuse, never give half-filled data').toEqual({
      status: 'refused',
      error: {
        code: 'UNSUPPORTED_FIELD_KIND',
        message:
          'O campo "state" usa um valor do tipo "binding", que o servidor só vai saber ' +
          'resolver no marco M2 (BAJAOVRLAY-20). Por enquanto, preencha o campo com um ' +
          'valor literal.',
      },
    });
    expect(
      resolution.status === 'refused' ? resolution.error.message : '',
      'the message must name the milestone that brings the missing kind',
    ).toContain('M2');
  });
});

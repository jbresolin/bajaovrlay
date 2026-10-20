/**
 * Resolving an item's field values into graphic data (apps/server)
 *
 * What this module is for:
 *   An item stores, for each field of its graphic, how the field gets its value. At
 *   the take, `resolveItemFieldsIntoGraphicData` turns those into the plain data the
 *   graphic receives. A field value is either a `literal` (typed by the operator, used
 *   as typed) or a `takeTime` (the clock time of the take itself, in milliseconds, which
 *   is how a prepared race clock starts counting from the moment it goes on air and not
 *   from the moment it was saved). A `binding` (BAJAOVRLAY-20) reads a data source;
 *   resolveItemFieldsWithBindings.test.ts covers it.
 *
 * What these tests prove:
 *   - Literal values of every JSON type pass through unchanged, under the same key,
 *     whatever the moment of the take.
 *   - A `takeTime` field becomes the milliseconds of the moment the function is given,
 *     so two takes of the same item at different moments give different values.
 *   - An item with no fields resolves to empty data.
 *   - A field value of a kind the server does not know yet refuses the whole
 *     resolution (no half-filled data) with a pt-BR message that names the entity library.
 *   - The fields given are not changed.
 *
 * What these tests deliberately do not cover:
 *   - Whether the resolved data suits the graphic; the take checks that.
 *   - Where the moment of the take comes from; the store hands it to the reducers, and
 *     takeItemTakeTime.test.ts and storeTakeTimeField.test.ts follow it to the screen.
 */
import type { ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { resolveItemFieldsIntoGraphicData } from './resolveItemFields.js';

/**
 * Resolves fields with no data source and no graphic registered, which literals and
 * takeTime never need: the bound fields have tests of their own
 * (resolveItemFieldsWithBindings.test.ts).
 */
function resolveFieldsWithoutSources(fields: ItemFields, momentOfTheTake: string) {
  return resolveItemFieldsIntoGraphicData({
    fields,
    graphic: undefined,
    momentOfTheTake,
    sources: { dataSources: [], dataSnapshots: [], overrides: [] },
  });
}

// The moment of a take as the store writes it, and the same moment in milliseconds:
// 14:32:05 UTC on 9 October 2026, during the endurance race.
const momentOfTheTake = '2026-10-09T14:32:05.000Z';
const momentOfTheTakeInMilliseconds = 1_791_556_325_000;
// A second take of the same item 15 minutes, 25 seconds and a quarter later.
const momentOfTheSecondTake = '2026-10-09T14:47:30.250Z';
const momentOfTheSecondTakeInMilliseconds = 1_791_557_250_250;

/** Builds the fields of "Largada do enduro" with the clock set to start at the take. */
function buildClockFieldsThatStartAtTheTake(): ItemFields {
  return {
    sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
    state: { kind: 'literal', value: 'green' },
    clockMode: { kind: 'literal', value: 'elapsed' },
    referenceTimeMs: { kind: 'literal', value: 0 },
    referenceWallClockMs: { kind: 'takeTime' },
    running: { kind: 'literal', value: true },
  };
}

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

    // Act: resolve them for a take at 14:32:05.
    const resolution = resolveFieldsWithoutSources(fields, momentOfTheTake);

    // Assert: resolved to the expected data, and the fields are as they were.
    expect(resolution, 'every literal must reach the data unchanged, under its key').toEqual({
      status: 'resolved',
      data: expectedData,
    });
    expect(fields, 'resolving must not change the fields it was given').toEqual(copyOfFieldsBefore);
  });
});

describe('resolveItemFieldsIntoGraphicData with a takeTime value', () => {
  it('gives the clock the milliseconds of the take as its reference moment', () => {
    // Arrange: the start of the enduro, prepared so the clock counts from the take.
    const fields = buildClockFieldsThatStartAtTheTake();
    const copyOfFieldsBefore = structuredClone(fields);

    // Act: resolve them for a take at 14:32:05.
    const resolution = resolveFieldsWithoutSources(fields, momentOfTheTake);

    // Assert: the reference moment is that take in milliseconds, a whole number as the
    // race clock requires; the literals are as typed; the stored fields still say takeTime.
    expect(resolution, 'a takeTime field must become the milliseconds of the take').toEqual({
      status: 'resolved',
      data: {
        sessionName: 'Enduro de Resistência',
        state: 'green',
        clockMode: 'elapsed',
        referenceTimeMs: 0,
        referenceWallClockMs: momentOfTheTakeInMilliseconds,
        running: true,
      },
    });
    expect(fields, 'the item must keep saying takeTime, ready for the next take').toEqual(
      copyOfFieldsBefore,
    );
  });

  it('gives two takes of the same item at different moments different values', () => {
    // Arrange: the same prepared fields, used for both takes.
    const fields = buildClockFieldsThatStartAtTheTake();

    // Act: resolve them for a take at 14:32:05 and for another at 14:47:30.250.
    const firstResolution = resolveFieldsWithoutSources(fields, momentOfTheTake);
    const secondResolution = resolveFieldsWithoutSources(fields, momentOfTheSecondTake);

    // Assert: each take carries its own moment, down to the quarter of a second.
    const referenceMomentOfEachTake = [firstResolution, secondResolution].map((resolution) =>
      resolution.status === 'resolved' ? resolution.data.referenceWallClockMs : undefined,
    );
    expect(
      referenceMomentOfEachTake,
      'each take must stamp its own moment, not the moment of an earlier take',
    ).toEqual([momentOfTheTakeInMilliseconds, momentOfTheSecondTakeInMilliseconds]);
  });

  it('gives the same value when asked twice about the same take', () => {
    // Arrange: the same prepared fields.
    const fields = buildClockFieldsThatStartAtTheTake();

    // Act: resolve them twice for the take at 14:32:05.
    const firstResolution = resolveFieldsWithoutSources(fields, momentOfTheTake);
    const secondResolution = resolveFieldsWithoutSources(fields, momentOfTheTake);

    // Assert: the answers are equal, so the function reads no clock of its own.
    expect(
      secondResolution,
      'the value must come from the moment given, never from the clock of the machine',
    ).toEqual(firstResolution);
  });
});

describe('resolveItemFieldsIntoGraphicData with a kind it does not know', () => {
  it('refuses the whole resolution with a message that names the entity library', () => {
    // Arrange: a lower third whose team name names a team of the entity library, which
    // only BAJAOVRLAY-19 will understand. Today's types do not allow it, so the test
    // forces it in. (Through the running server this cannot happen yet: the command
    // schema refuses such a command and a stored item like this stops the boot. This is
    // a guard for the day the schema accepts it before the resolver has its case.)
    const fieldsWithEntity = {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'entity', entityType: 'team', entityId: '42', attribute: 'name' },
    } as unknown as ItemFields;

    // Act: resolve them.
    const resolution = resolveFieldsWithoutSources(fieldsWithEntity, momentOfTheTake);

    // Assert: refused as a whole, naming the field, its kind and the entity library.
    expect(resolution, 'an unknown kind must refuse, never give half-filled data').toEqual({
      status: 'refused',
      error: {
        code: 'UNSUPPORTED_FIELD_KIND',
        message:
          'O campo "state" usa um valor do tipo "entity", que o servidor só vai saber ' +
          'resolver com a biblioteca de entidades (BAJAOVRLAY-19). Por enquanto, preencha ' +
          'o campo com um valor literal ou de uma fonte de dados.',
      },
    });
  });
});

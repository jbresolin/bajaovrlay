/**
 * Race clock data model (packages/graphics/race-clock)
 *
 * What this module is for:
 *   Everything the race clock shows comes from one small data object: the session name,
 *   the flag state, the clock reading and, optionally, the leader's lap count. The
 *   renderer sends the whole object to `load` and then partial changes to
 *   `updateAction`. This module checks that data and merges the partial changes in, and
 *   explains in pt-BR what is wrong when the data is bad, so the graphic can answer
 *   400 instead of throwing.
 *
 * What these tests prove:
 *   - Complete, correct data is accepted as it is.
 *   - Data missing a required field, with a wrong value, or with a field the graphic
 *     does not know is refused with a pt-BR message naming the field.
 *   - A partial update changes only the fields it carries and keeps every other field.
 *   - A bad partial update is refused and leaves nothing half-applied.
 *
 * What these tests deliberately do not cover:
 *   - That the manifest's JSON Schema agrees with these rules; raceClockManifest.test.ts
 *     runs the same payloads through both.
 *   - What the component answers on the wire (status codes); race-clock.test.ts does.
 */
import { describe, expect, it } from 'vitest';

import {
  mergePartialUpdateIntoRaceClockData,
  parseCompleteRaceClockData,
  type RaceClockData,
} from './raceClockModel.js';

/** Builds the data the server sends when the enduro is under green flag, 1:05:00 in. */
function createGreenFlagEnduroData(): RaceClockData {
  return {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_900_000,
    referenceWallClockMs: Date.parse('2026-05-16T14:30:00.000Z'),
    running: true,
    lapsCompletedByLeader: 12,
  };
}

describe('parseCompleteRaceClockData', () => {
  it('accepts complete, correct data unchanged', () => {
    // Arrange: the data for an enduro under green flag.
    const enduroData = createGreenFlagEnduroData();

    // Act: check it as `load` does.
    const result = parseCompleteRaceClockData(enduroData);

    // Assert: it is valid and comes back exactly as sent.
    expect(result, 'correct data must be accepted exactly as sent').toEqual({
      isValid: true,
      data: enduroData,
    });
  });

  it('accepts data without the optional leader lap count', () => {
    // Arrange: a qualifying session has no laps to show, so the field is left out.
    const qualifyingData: Partial<RaceClockData> = createGreenFlagEnduroData();
    delete qualifyingData.lapsCompletedByLeader;

    // Act: check it as `load` does.
    const result = parseCompleteRaceClockData(qualifyingData);

    // Assert: the lap count really is optional.
    expect(result.isValid, 'data without lapsCompletedByLeader must still be valid').toBe(true);
  });

  const refusedDataScenarios = [
    {
      // The most likely mistake from a hand-written payload: a field left out.
      name: 'refuses data missing the session name',
      data: { ...createGreenFlagEnduroData(), sessionName: undefined },
      expectedProblem: 'Falta o campo obrigatório "sessionName".',
    },
    {
      // A flag state that is not one of the six the graphic can draw.
      name: 'refuses a flag state the graphic does not know',
      data: { ...createGreenFlagEnduroData(), state: 'blue' },
      expectedProblem: 'Valor inválido no campo "state".',
    },
    {
      // Milliseconds must be whole numbers; a fraction means a unit mix-up upstream.
      name: 'refuses a clock reading that is not a whole number of milliseconds',
      data: { ...createGreenFlagEnduroData(), referenceTimeMs: 3_900_000.5 },
      expectedProblem: 'Valor inválido no campo "referenceTimeMs".',
    },
    {
      // A typo in a field name would otherwise be silently ignored.
      name: 'refuses a field the graphic does not know, such as a typo',
      data: { ...createGreenFlagEnduroData(), lapsCompletedByLeadr: 12 },
      expectedProblem: 'Campo desconhecido nos dados: "lapsCompletedByLeadr".',
    },
    {
      // Something that is not an object at all, such as an empty load.
      name: 'refuses something that is not a data object',
      data: 'Enduro de Resistência',
      expectedProblem: 'Dados inválidos: era esperado um objeto com os dados do relógio.',
    },
  ];

  it.each(refusedDataScenarios)('$name', ({ data, expectedProblem }) => {
    // Arrange: the bad data comes from the scenario row above.

    // Act: check it as `load` does.
    const result = parseCompleteRaceClockData(data);

    // Assert: it is refused with a pt-BR message that names the problem.
    expect(result, 'bad data must be refused with a pt-BR message naming the field').toEqual({
      isValid: false,
      problem: expectedProblem,
    });
  });
});

describe('mergePartialUpdateIntoRaceClockData', () => {
  it('changes only the fields the update carries and keeps the rest', () => {
    // Arrange: the clock is under green flag; race control throws the yellow.
    const currentData = createGreenFlagEnduroData();
    const yellowFlagUpdate = { state: 'yellow' };

    // Act: merge the one-field update into the current data.
    const result = mergePartialUpdateIntoRaceClockData(currentData, yellowFlagUpdate);

    // Assert: only the flag changed; session, clock and laps are untouched.
    expect(result, 'a partial update must change only the fields it carries').toEqual({
      isValid: true,
      data: { ...createGreenFlagEnduroData(), state: 'yellow' },
    });
  });

  it('applies several fields at once, as a red flag that stops the clock does', () => {
    // Arrange: red flag: the clock stops at the time the server read it.
    const currentData = createGreenFlagEnduroData();
    const redFlagUpdate = {
      state: 'red',
      running: false,
      referenceTimeMs: 4_210_000,
      referenceWallClockMs: Date.parse('2026-05-16T14:35:10.000Z'),
    };

    // Act: merge the update.
    const result = mergePartialUpdateIntoRaceClockData(currentData, redFlagUpdate);

    // Assert: all four fields changed together; the rest stayed.
    expect(result, 'every field in the update must be applied together').toEqual({
      isValid: true,
      data: { ...createGreenFlagEnduroData(), ...redFlagUpdate },
    });
  });

  it('refuses a bad update and leaves the current data untouched', () => {
    // Arrange: an update whose flag state is misspelled.
    const currentData = createGreenFlagEnduroData();
    const misspelledUpdate = { state: 'amarela' };

    // Act: try to merge it.
    const result = mergePartialUpdateIntoRaceClockData(currentData, misspelledUpdate);

    // Assert: refused with a pt-BR message; the current data was not changed.
    expect(result, 'a bad update must be refused with a pt-BR message').toEqual({
      isValid: false,
      problem: 'Valor inválido no campo "state".',
    });
    expect(currentData, 'a refused update must not change the current data').toEqual(
      createGreenFlagEnduroData(),
    );
  });

  it('refuses an update carrying a field the graphic does not know', () => {
    // Arrange: an update with a field from some other graphic.
    const currentData = createGreenFlagEnduroData();
    const updateForAnotherGraphic = { teamName: 'Baja UFPR' };

    // Act: try to merge it.
    const result = mergePartialUpdateIntoRaceClockData(currentData, updateForAnotherGraphic);

    // Assert: refused, naming the unknown field.
    expect(result, 'an unknown field must be refused, not ignored').toEqual({
      isValid: false,
      problem: 'Campo desconhecido nos dados: "teamName".',
    });
  });
});

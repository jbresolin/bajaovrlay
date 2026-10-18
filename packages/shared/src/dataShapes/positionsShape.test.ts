/**
 * The rules of the positions shape (packages/shared)
 *
 * What this module is for:
 *   The positions shape is every car of one session in order, which the positions tower
 *   and the team card read. Some of its rules span several cars (the gaps, the order),
 *   so a schema field alone cannot say them; positionsShape.ts checks them after the
 *   fields (decision D2 of BAJAOVRLAY-17).
 *
 * What these tests prove:
 *   - Each rule refuses the payload that breaks it, and the refusal is the exact pt-BR
 *     sentence the operator reads, naming the path of the bad car or field. Asserting the
 *     whole sentence proves which rule fired, not only where.
 *   - The rules: positions run 1..n in order; a car appears once; a car never has more
 *     laps than the car ahead; the leader carries no gap and no interval; before the
 *     leader's first lap nobody carries a gap; after it, a car on the leader's lap carries
 *     its gap in ms, any other car carries it in laps, equal to the laps it is behind; a
 *     car with no lap carries no interval.
 *   - The start of the race, with no lap and no gap, is accepted.
 *
 * What these tests deliberately do not cover:
 *   - That the 60-car sample passes; that is dataShapes.test.ts with the other samples.
 *   - The field-by-field checks Zod does on its own beyond one example each (a status
 *     outside the list, a negative lap time, a zero-lap gap).
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { validateDataShape } from './validateDataShape.js';

/** The positions sample as plain JSON: an object whose entries can be changed one by one. */
type PositionsSamplePayload = { entries: Array<Record<string, unknown>> } & Record<string, unknown>;

/**
 * Reads the 60-car positions sample afresh, so each test can break one thing in its own
 * copy without touching the file or another test.
 */
function readPositionsSample(): PositionsSamplePayload {
  const sampleUrl = new URL('./samples/positions.enduro-lap-34.json', import.meta.url);
  return JSON.parse(readFileSync(sampleUrl, 'utf8')) as PositionsSamplePayload;
}

/** A short positions payload at the start of the race: nobody has completed a lap yet. */
function buildPositionsAtTheStart(): PositionsSamplePayload {
  return {
    sessionId: 'enduro-2027-nacional',
    updatedAtMs: 1_805_558_400_000,
    entries: [
      {
        position: 1,
        carNumber: 42,
        teamName: 'Carcará Baja',
        schoolName: 'UFPR',
        laps: 0,
        status: 'running',
      },
      {
        position: 2,
        carNumber: 7,
        teamName: 'Pequi Off-Road',
        schoolName: 'UFG',
        laps: 0,
        status: 'running',
      },
    ],
  };
}

describe('positions a source must never send', () => {
  // In the sample: the leader (car 31) and 2nd (car 38) are on lap 34; 3rd to 9th are on
  // lap 33, one lap down; 6th is car 52.
  const refusedPositionsScenarios: Array<{
    name: string;
    buildPayload: () => unknown;
    expectedErrorMessage: string;
  }> = [
    // Brief rule: a gap is in ms OR in laps; both at once would make the graphic guess.
    {
      name: 'refuses a car with a gap in both ms and laps',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[1] = { ...positions.entries[1], gapToLeaderLaps: 1 };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.1": cada carro atrás do líder tem exatamente uma diferença, em tempo ou em voltas.',
    },
    // Brief rule: the leader is the reference, so a gap on it is nonsense.
    {
      name: 'refuses a leader with a gap',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[0] = { ...positions.entries[0], gapToLeaderMs: 1_200 };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.0": o líder não tem diferença para si mesmo.',
    },
    // D2: once the leader has a lap, a car behind it with no gap is a source that lost data.
    {
      name: 'refuses a car behind a leader with laps that carries no gap',
      buildPayload: () => {
        const positions = readPositionsSample();
        const secondPlace = { ...positions.entries[1] };
        delete secondPlace.gapToLeaderMs;
        delete secondPlace.gapToLeaderLaps;
        positions.entries[1] = secondPlace;
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.1": cada carro atrás do líder tem exatamente uma diferença, em tempo ou em voltas.',
    },
    // D2: before anyone completes a lap there is no gap to know; a number would be invented.
    {
      name: 'refuses a gap at the start, before the leader has completed a lap',
      buildPayload: () => {
        const positions = buildPositionsAtTheStart();
        positions.entries[1] = { ...positions.entries[1], gapToLeaderMs: 800 };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.1": antes de o líder completar uma volta, ninguém tem diferença.',
    },
    // D2: a car on the leader's lap is behind by time; "+7 voltas" on it would be false.
    {
      name: "refuses a gap in laps on a car that is on the leader's lap",
      buildPayload: () => {
        const positions = readPositionsSample();
        const secondPlace: Record<string, unknown> = {
          ...positions.entries[1],
          gapToLeaderLaps: 7,
        };
        delete secondPlace.gapToLeaderMs;
        positions.entries[1] = secondPlace;
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.1": um carro na mesma volta do líder tem a diferença em tempo, não em voltas.',
    },
    // D2: a lapped car is behind by laps; a time gap would hide that it was lapped.
    {
      name: 'refuses a gap in ms on a car that is laps down',
      buildPayload: () => {
        const positions = readPositionsSample();
        const thirdPlace: Record<string, unknown> = {
          ...positions.entries[2],
          gapToLeaderMs: 41_000,
        };
        delete thirdPlace.gapToLeaderLaps;
        positions.entries[2] = thirdPlace;
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.2": um carro com menos voltas que o líder tem a diferença em voltas, não em tempo.',
    },
    // D2: the gap in laps is the laps behind; car 25 has 33 to the leader's 34, so 1, not 3.
    {
      name: 'refuses a gap in laps that does not match the laps behind the leader',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[2] = { ...positions.entries[2], gapToLeaderLaps: 3 };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.2": a diferença em voltas deve ser igual às voltas atrás do líder, aqui 1.',
    },
    // D2: a lapped car is at least one lap down; "0 laps" would be a placeholder.
    {
      name: 'refuses a gap of zero laps',
      buildPayload: () => {
        const positions = readPositionsSample();
        const lastPlace = positions.entries.length - 1;
        positions.entries[lastPlace] = { ...positions.entries[lastPlace], gapToLeaderLaps: 0 };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.59.gapToLeaderLaps": valor abaixo do mínimo.',
    },
    // The order is by laps first; a car with more laps than the one ahead is out of place.
    {
      name: 'refuses a car with more laps than the car ahead of it',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[2] = { ...positions.entries[2], laps: 35 };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.2.laps": um carro não pode ter mais voltas que o carro à frente, que tem 34.',
    },
    // The leader has no car ahead, so a tower bound to its interval would show a made-up one.
    {
      name: 'refuses a leader with an interval',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[0] = { ...positions.entries[0], intervalMs: 5_000 };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.0.intervalMs": o líder não tem intervalo, porque não há carro à frente.',
    },
    // An interval is measured at the car's last lap; with no lap there is nothing to measure.
    {
      name: 'refuses an interval on a car that has not completed a lap',
      buildPayload: () => {
        const positions = buildPositionsAtTheStart();
        positions.entries[1] = { ...positions.entries[1], intervalMs: 800 };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.1.intervalMs": antes de completar uma volta, um carro não tem intervalo.',
    },
    // D2: entries come ordered by position, 1..n, so the graphic can trust the order.
    {
      name: 'refuses positions out of order',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[2] = { ...positions.entries[2], position: 4 };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.2.position": as posições devem vir em ordem, 1, 2, 3...; aqui era esperada a posição 3.',
    },
    // A car listed twice would show twice on the tower.
    {
      name: 'refuses the same car twice in the positions',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[5] = {
          ...positions.entries[5],
          carNumber: positions.entries[4]?.carNumber,
        };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.5.carNumber": o carro 52 aparece mais de uma vez.',
    },
    // The status list is closed; the tower has a look for each one only.
    {
      name: 'refuses an unknown status',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[3] = { ...positions.entries[3], status: 'quebrado' };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.3.status": valor fora da lista permitida.',
    },
    // A lap cannot take negative time; a source sending one is broken.
    {
      name: 'refuses a negative lap time',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[0] = { ...positions.entries[0], lastLapMs: -312_000 };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.0.lastLapMs": valor abaixo do mínimo.',
    },
  ];

  it.each(refusedPositionsScenarios)('$name', ({ buildPayload, expectedErrorMessage }) => {
    // Arrange: a payload with the one mistake of this row.
    const brokenPayload = buildPayload();

    // Act: validate it as positions.
    const validation = validateDataShape('positions', brokenPayload);

    // Assert: refused, with the pt-BR sentence of this row's rule at the bad path.
    expect(validation, 'the payload must be refused for the rule this row breaks').toEqual({
      isValid: false,
      errorMessage: expectedErrorMessage,
    });
  });

  it('accepts the start of the race, when nobody has a lap and nobody has a gap', () => {
    // Arrange: two cars on the grid, no lap completed.
    const positionsAtTheStart = buildPositionsAtTheStart();

    // Act: validate them.
    const validation = validateDataShape('positions', positionsAtTheStart);

    // Assert: valid, because an unknown gap is simply left out.
    expect(validation.isValid, 'no gap before the first lap must be accepted').toBe(true);
  });
});

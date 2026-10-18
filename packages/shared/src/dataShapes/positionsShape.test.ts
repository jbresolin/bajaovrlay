/**
 * The rules of the positions shape (packages/shared)
 *
 * What this module is for:
 *   The positions shape is every car of one session in order, which the positions tower
 *   and the team card read. Some of its rules span several cars (the gaps, the order),
 *   so a schema field alone cannot say them; positionsShape.ts checks them after the
 *   fields. Since gate 2 of PR #16 (João's ruling) the shape accepts what a source gives:
 *   a gap may be left out, and a car out of the race may sit out of lap order.
 *
 * What these tests prove:
 *   - Each rule refuses the payload that breaks it, and the refusal is the exact pt-BR
 *     sentence the operator reads, naming the path of the bad car or field. Asserting the
 *     whole sentence proves which rule fired, not only where.
 *   - The rules: positions run 1..n in order; a car appears once; a car still in the race
 *     (running, in the pit or stopped) never has more laps than the nearest car still in
 *     the race ahead of it; the leader (position 1, whatever its status) carries no gap and no
 *     interval; a gap, when there is one, is of the right kind (in ms on the leader's lap,
 *     in laps equal to the laps behind when lapped, none on a car with more laps than the
 *     leader, even when the leader is out of the race) and never both; a lap time is above
 *     zero, so a last or best lap of zero is refused.
 *
 * What these tests deliberately do not cover:
 *   - What a real source may send and the shape accepts (a missing gap, cars out of the
 *     race out of lap order); that is positionsShapeAcceptsWhatSourcesSend.test.ts.
 *   - That the 60-car sample passes; that is dataShapes.test.ts with the other samples.
 *   - The field-by-field checks Zod does on its own beyond one example each (a status
 *     outside the list, a negative lap time, a zero-lap gap).
 */
import { describe, expect, it } from 'vitest';

import {
  buildPositionsWithDisqualifiedCarFirst,
  lastPlaceIndex,
  readPositionsSample,
  withoutAnyGap,
} from './positionsShape.testSupport.js';
import { validateDataShape } from './validateDataShape.js';

describe('positions a source must never send', () => {
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
        'Dados inválidos em "positions.entries.1": um carro tem no máximo uma diferença para o líder, em tempo ou em voltas.',
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
    // Gate 2: the leader is position 1 whatever its status. With a disqualified car on 12
    // laps listed first, car 38 (now 3rd, 34 laps) has more laps than that leader, so the
    // gap it carries from the sample is refused; such a source must leave the gaps out.
    {
      name: 'refuses a gap below a car out of the race listed first with fewer laps',
      buildPayload: () => buildPositionsWithDisqualifiedCarFirst(),
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.2": um carro com mais voltas que o líder não tem diferença para ele.',
    },
    // A car on the leader's lap is behind by time; "+7 voltas" on it would be false.
    {
      name: "refuses a gap in laps on a car that is on the leader's lap",
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[1] = { ...withoutAnyGap(positions.entries[1]), gapToLeaderLaps: 7 };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.1": um carro na mesma volta do líder tem a diferença em tempo, não em voltas.',
    },
    // Gate 2: a lapped car is behind by laps; a time gap would hide that it was lapped.
    {
      name: 'refuses a gap in ms on a car that is laps down',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[2] = { ...withoutAnyGap(positions.entries[2]), gapToLeaderMs: 41_000 };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.2": um carro com menos voltas que o líder tem a diferença em voltas, não em tempo.',
    },
    // The gap in laps is the laps behind; car 25 has 33 to the leader's 34, so 1, not 3.
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
    // A retired car may have more laps than the leader, but then it is behind the leader
    // by nothing a gap could say.
    {
      name: 'refuses a gap on a retired car that has more laps than the leader',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[lastPlaceIndex] = {
          ...positions.entries[lastPlaceIndex],
          laps: 36,
          gapToLeaderLaps: 2,
        };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.59": um carro com mais voltas que o líder não tem diferença para ele.',
    },
    // A lapped car is at least one lap down; "0 laps" would be a placeholder.
    {
      name: 'refuses a gap of zero laps',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[lastPlaceIndex] = {
          ...positions.entries[lastPlaceIndex],
          gapToLeaderLaps: 0,
        };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.59.gapToLeaderLaps": valor abaixo do mínimo.',
    },
    // The order is by laps first; a running car with more laps than the one ahead is out
    // of place.
    {
      name: 'refuses a running car with more laps than the running car ahead of it',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[2] = { ...positions.entries[2], laps: 35 };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.2.laps": um carro em prova não pode ter mais voltas que o carro em prova à frente dele, que tem 34.',
    },
    // Gate 2: a retired car in between is passed over, but the rule still holds for the
    // running car behind it: car 96, now running on 25 laps, is compared with 58th place
    // (24 laps), not with the retired 59th (30 laps).
    {
      name: 'refuses a running car with more laps than the nearest running car ahead, past a retired one',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[58] = {
          ...positions.entries[58],
          laps: 30,
          gapToLeaderLaps: 4,
          status: 'retired',
        };
        positions.entries[lastPlaceIndex] = {
          ...positions.entries[lastPlaceIndex],
          laps: 25,
          gapToLeaderLaps: 9,
          status: 'running',
        };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.59.laps": um carro em prova não pode ter mais voltas que o carro em prova à frente dele, que tem 24.',
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
    // Entries come ordered by position, 1..n, so the graphic can trust the order.
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
    // Two cars in the same place would leave the tower guessing which one to show.
    {
      name: 'refuses a position repeated',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[3] = { ...positions.entries[3], position: 3 };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.3.position": as posições devem vir em ordem, 1, 2, 3...; aqui era esperada a posição 4.',
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
    // Gate 2: no lap takes no time, so a last lap of 0 is a placeholder for "unknown",
    // which the shape says by leaving the field out.
    {
      name: 'refuses a last lap of zero',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[4] = { ...positions.entries[4], lastLapMs: 0 };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.4.lastLapMs": valor abaixo do mínimo.',
    },
    // Gate 2: the same for the best lap; a tower would show "0:00.000" as a record.
    {
      name: 'refuses a best lap of zero',
      buildPayload: () => {
        const positions = readPositionsSample();
        positions.entries[4] = { ...positions.entries[4], bestLapMs: 0 };
        return positions;
      },
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.4.bestLapMs": valor abaixo do mínimo.',
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
});

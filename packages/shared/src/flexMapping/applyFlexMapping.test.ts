/**
 * Applying a flex mapping to the responses of one poll (packages/shared)
 *
 * What this module is for:
 *   A flex source fetches JSON whose shape is not ours and maps it into the canonical
 *   shapes with its mapping config. `applyFlexMapping` is that step, pure, so the server's
 *   adapter and the control page's "Testar" panel run the same function on the same input.
 *   Its output then goes through `validateDataShape`, as every other source's does.
 *
 * What these tests prove:
 *   - The example preset maps the example response (20 fictional cars from an imaginary
 *     timing system) into positions and session that pass validateDataShape, with the
 *     codes, texts and moments turned into canonical values and the extra keys ignored.
 *   - `fromListOrder` gives places 1..n; `fromPollMoment` gives the moment it is handed.
 *   - A null or missing optional field is left out; a missing required one is left out
 *     too, and the canonical validation then names it.
 *   - One unreadable lap time fails the whole mapping, with the car, the line and the
 *     path in the problem line; a car whose number cannot be read is named by its line.
 *   - Problems are capped at 20 and summarised in one line for the poll error.
 *   - A missing response and a missing list are problems, not empty shapes.
 *
 * What these tests deliberately do not cover:
 *   - Checking the config (paths, transforms, targets); flexMappingConfig.test.ts does.
 *   - Each transform's own readings; the transforms' own tests cover them.
 *   - Fetching the responses; the server's httpJson adapter does that.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { validateDataShape } from '../dataShapes/validateDataShape.js';
import { applyFlexMapping, type FlexMappingResult } from './applyFlexMapping.js';
import { type FlexMappingConfig, FlexMappingConfigSchema } from './flexMappingConfig.js';

/** The example response as plain JSON: a list of cars that a test can break one by one. */
type ExampleResponse = { classificacao: Array<Record<string, unknown>> } & Record<string, unknown>;

/** Reads the example timing-system response afresh, so each test can break its own copy. */
function readExampleResponse(): ExampleResponse {
  const responseUrl = new URL('./examples/timing-system-like.response.json', import.meta.url);
  return JSON.parse(readFileSync(responseUrl, 'utf8')) as ExampleResponse;
}

/** Reads the example preset's mappings and checks them, as a saved config is checked. */
function readExampleMappings(): FlexMappingConfig {
  const configUrl = new URL('./examples/timing-system-like.config.json', import.meta.url);
  const config = JSON.parse(readFileSync(configUrl, 'utf8')) as { mappings: unknown };
  return FlexMappingConfigSchema.parse(config.mappings);
}

/** Reads one car of the example response by its line (from 0), failing loudly if absent. */
function readCarAtLine(response: ExampleResponse, lineIndex: number): Record<string, unknown> {
  const car = response.classificacao[lineIndex];
  if (car === undefined) {
    throw new Error(`the example response has no car at line index ${String(lineIndex)}`);
  }
  return car;
}

/** The moment of the poll in these tests: 14:24:01.200 in Brasília, 17:24:01.200 UTC. */
const pollMomentMs = Date.UTC(2027, 2, 20, 17, 24, 1, 200);

/** The moment the example response says it was made: 14:24:00.948 in Brasília (−03:00). */
const responseMadeAtMs = Date.UTC(2027, 2, 20, 17, 24, 0, 948);

/** The shapes of a mapping that worked, or a failure that names the first problem. */
function readShapesOfSuccess(result: FlexMappingResult) {
  if (!result.ok) {
    throw new Error(`the mapping was expected to work but failed: ${result.summary}`);
  }
  return result.shapes;
}

/** The car entries of a mapping that worked, as plain objects. */
function readPositionEntries(result: FlexMappingResult): Array<Record<string, unknown>> {
  const positions = readShapesOfSuccess(result).positions as {
    entries: Array<Record<string, unknown>>;
  };
  return positions.entries;
}

describe('applyFlexMapping with the example preset', () => {
  it('maps the example response into positions and session that pass the canonical shapes', () => {
    // Arrange: the example timing-system response and the preset written for it.
    const response = readExampleResponse();
    const mappings = readExampleMappings();

    // Act: map it, then validate each shape exactly as the store does.
    const result = applyFlexMapping(mappings, { classificacao: response }, pollMomentMs);
    const shapes = readShapesOfSuccess(result);
    const positionsValidation = validateDataShape('positions', shapes.positions);
    const sessionValidation = validateDataShape('session', shapes.session);

    // Assert: both shapes are produced and both pass, with all 20 cars.
    expect(Object.keys(shapes).sort(), 'the preset must give positions and session').toEqual([
      'positions',
      'session',
    ]);
    expect(positionsValidation, 'the mapped positions must pass the positions shape').toEqual({
      isValid: true,
      shape: shapes.positions,
    });
    expect(sessionValidation, 'the mapped session must pass the session shape').toEqual({
      isValid: true,
      shape: shapes.session,
    });
    expect(readPositionEntries(result), 'all 20 cars must be mapped').toHaveLength(20);
  });

  it('turns the leader and the car behind it into canonical entries', () => {
    // Arrange: the example response and preset.
    const response = readExampleResponse();
    const mappings = readExampleMappings();

    // Act: map it and keep the first two cars.
    const result = applyFlexMapping(mappings, { classificacao: response }, pollMomentMs);
    const [leader, secondCar] = readPositionEntries(result);

    // Assert: texts read as numbers and ms, codes as statuses, the leader's null gap left out.
    expect(leader, 'car 17 leads, with no gap and no interval').toEqual({
      position: 1,
      carNumber: 17,
      teamName: 'Acauã Baja',
      schoolName: 'Mauá',
      laps: 34,
      status: 'running',
      lastLapMs: 278_293,
      bestLapMs: 278_291,
      pitStops: 2,
    });
    expect(secondCar, 'car 6 is second, 19,087 s behind on the same lap').toEqual({
      position: 2,
      carNumber: 6,
      teamName: 'Sabiá Baja',
      schoolName: 'UFMG',
      laps: 34,
      status: 'running',
      lastLapMs: 283_550,
      bestLapMs: 279_596,
      gapToLeaderMs: 19_087,
      intervalMs: 19_087,
      pitStops: 2,
    });
  });

  it('brings a car the timing system marks BOX out inPit, a lap down', () => {
    // Arrange: the example response, whose 10th car (car 5) is in the pits.
    const response = readExampleResponse();
    const mappings = readExampleMappings();

    // Act: map it and keep the 10th car.
    const result = applyFlexMapping(mappings, { classificacao: response }, pollMomentMs);
    const tenthCar = readPositionEntries(result)[9];

    // Assert: BOX became inPit, and its gap in laps was read from diferenca.voltas.
    expect(tenthCar?.carNumber, 'the 10th car must be car 5').toBe(5);
    expect(tenthCar?.status, 'a car marked BOX must come out inPit').toBe('inPit');
    expect(tenthCar?.gapToLeaderLaps, 'car 5 is one lap down').toBe(1);
    expect(tenthCar?.gapToLeaderMs, 'a lapped car has no gap in time').toBeUndefined();
  });

  it('maps the session with its flag, clock and moments in canonical values', () => {
    // Arrange: the example response and preset.
    const response = readExampleResponse();
    const mappings = readExampleMappings();

    // Act: map it and keep the session.
    const result = applyFlexMapping(mappings, { classificacao: response }, pollMomentMs);
    const session = readShapesOfSuccess(result).session;

    // Assert: VERDE is green, REGRESSIVO is remaining, RUN is true, the zone was honoured,
    // and the response's own keys ("aviso", "sistema") are not carried over.
    expect(session, 'the session must be the canonical reading of "prova"').toEqual({
      sessionId: 'enduro-2027-nacional',
      eventName: 'Baja SAE Brasil 2027 — Etapa Nacional',
      sessionName: 'Enduro de Resistência',
      sessionKind: 'enduro',
      state: 'green',
      clock: {
        clockMode: 'remaining',
        referenceTimeMs: 4_559_052,
        referenceWallClockMs: responseMadeAtMs,
        running: true,
      },
      updatedAtMs: responseMadeAtMs,
      scheduledDurationMs: 14_400_000,
      lapsCompletedByLeader: 34,
    });
  });
});

describe('the sources of a rule', () => {
  it('numbers the cars 1 to 20 by their order in the list', () => {
    // Arrange: the example response, which sends no position numbers.
    const response = readExampleResponse();
    const mappings = readExampleMappings();

    // Act: map it and read every place.
    const result = applyFlexMapping(mappings, { classificacao: response }, pollMomentMs);
    const places = readPositionEntries(result).map((entry) => entry.position);

    // Assert: 1, 2, 3 … 20, in list order.
    const expectedPlaces = Array.from({ length: 20 }, (_, index) => index + 1);
    expect(places, 'the place must be the 1-based order in the list').toEqual(expectedPlaces);
  });

  it('stamps the positions with the poll moment it is given', () => {
    // Arrange: the example preset, whose positions take updatedAtMs from the poll.
    const response = readExampleResponse();
    const mappings = readExampleMappings();
    const anotherPollMomentMs = Date.UTC(2027, 2, 20, 17, 30, 0, 0);

    // Act: map the same response at another moment.
    const result = applyFlexMapping(mappings, { classificacao: response }, anotherPollMomentMs);
    const positions = readShapesOfSuccess(result).positions as { updatedAtMs: number };

    // Assert: the moment handed in, not a clock read inside the mapping.
    expect(positions.updatedAtMs, 'updatedAtMs must be the poll moment').toBe(anotherPollMomentMs);
  });
});

describe('fields the source does not send', () => {
  it('leaves out the last lap of a car that has none yet', () => {
    // Arrange: the example response, whose last car (car 16, retired early) has a null last lap.
    const response = readExampleResponse();
    const mappings = readExampleMappings();

    // Act: map it and keep the last car.
    const result = applyFlexMapping(mappings, { classificacao: response }, pollMomentMs);
    const lastCar = readPositionEntries(result)[19];

    // Assert: no lastLapMs at all, not a null or a zero.
    expect(lastCar?.carNumber, 'the last car must be car 16').toBe(16);
    expect(lastCar, 'a null last lap must be left out').not.toHaveProperty('lastLapMs');
    expect(lastCar?.status, 'car 16 retired').toBe('retired');
  });

  it('leaves out the pit stops of a car whose response has no such key', () => {
    // Arrange: the 4th car's "paradas" key taken out of the response.
    const response = readExampleResponse();
    delete readCarAtLine(response, 3).paradas;
    const mappings = readExampleMappings();

    // Act: map it.
    const result = applyFlexMapping(mappings, { classificacao: response }, pollMomentMs);
    const fourthCar = readPositionEntries(result)[3];

    // Assert: the mapping still works, without pitStops on that car.
    expect(fourthCar, 'a missing optional key must be left out').not.toHaveProperty('pitStops');
  });

  it('leaves out a missing school, and the canonical validation names it', () => {
    // Arrange: the 3rd car's "escola" key taken out of the response.
    const response = readExampleResponse();
    delete readCarAtLine(response, 2).escola;
    const mappings = readExampleMappings();

    // Act: map it, then validate the positions as the store does.
    const result = applyFlexMapping(mappings, { classificacao: response }, pollMomentMs);
    const positionsValidation = validateDataShape(
      'positions',
      readShapesOfSuccess(result).positions,
    );

    // Assert: the mapping does not invent a school; the validation refuses the gap it left.
    expect(positionsValidation, 'a missing required field must fail validation, named').toEqual({
      isValid: false,
      errorMessage:
        'Dados inválidos em "positions.entries.2.schoolName": campo ausente ou de tipo errado.',
    });
  });
});

describe('values the mapping cannot read', () => {
  it('fails the whole mapping on one unreadable lap time, naming the car, line and path', () => {
    // Arrange: the 3rd car's last lap mistyped by the timing system.
    const response = readExampleResponse();
    readCarAtLine(response, 2).ultima_volta = '4:3x.293';
    const mappings = readExampleMappings();

    // Act: map it.
    const result = applyFlexMapping(mappings, { classificacao: response }, pollMomentMs);

    // Assert: no shapes at all, and one problem line saying exactly where.
    const expectedProblem =
      'Posições › carro 11 (linha 3) › Última volta: não consegui ler "ultima_volta": "4:3x.293" não é um tempo de volta como 4:38.293, 278.293 ou 1:02:03.4';
    expect(result, 'one unreadable value must fail the whole poll').toEqual({
      ok: false,
      problems: [expectedProblem],
      summary: expectedProblem,
    });
  });

  it('names a car by its line alone when its number cannot be read', () => {
    // Arrange: the 5th car's number sent as "8A", which is not a whole number.
    const response = readExampleResponse();
    readCarAtLine(response, 4).carro = '8A';
    const mappings = readExampleMappings();

    // Act: map it.
    const result = applyFlexMapping(mappings, { classificacao: response }, pollMomentMs);

    // Assert: the problem names line 5, since there is no car number to name.
    expect(result.ok, 'an unreadable car number must fail the mapping').toBe(false);
    expect(
      result.ok ? [] : result.problems,
      'the problem must name the line, the field and the path',
    ).toEqual([
      'Posições › linha 5 › Carro: não consegui ler "carro": "8A" não é um número inteiro',
    ]);
  });

  it('lists the first 20 problems and summarises the rest in the poll error', () => {
    // Arrange: every car's last and best lap sent in a format nobody reads: 40 problems.
    const response = readExampleResponse();
    for (const car of response.classificacao) {
      car.ultima_volta = '4m38s';
      car.melhor_volta = '4m38s';
    }
    const mappings = readExampleMappings();

    // Act: map it.
    const result = applyFlexMapping(mappings, { classificacao: response }, pollMomentMs);

    // Assert: 20 lines, starting with the leader's last lap, and a summary counting the rest.
    if (result.ok) {
      throw new Error('forty unreadable lap times must fail the mapping');
    }
    const firstProblem =
      'Posições › carro 17 (linha 1) › Última volta: não consegui ler "ultima_volta": "4m38s" não é um tempo de volta como 4:38.293, 278.293 ou 1:02:03.4';
    expect(result.problems, 'only the first 20 problems are listed').toHaveLength(20);
    expect(result.problems[0], 'the first problem is the leader’s last lap').toBe(firstProblem);
    expect(result.summary, 'the poll error is the first problem plus the count of the rest').toBe(
      `${firstProblem} (e mais 39 problemas)`,
    );
  });

  it('says "e mais 1 problema" when there are exactly two', () => {
    // Arrange: two cars with an unreadable last lap.
    const response = readExampleResponse();
    readCarAtLine(response, 0).ultima_volta = '4m38s';
    readCarAtLine(response, 1).ultima_volta = '4m43s';
    const mappings = readExampleMappings();

    // Act: map it.
    const result = applyFlexMapping(mappings, { classificacao: response }, pollMomentMs);

    // Assert: both are listed, and the summary counts one more in the singular.
    const firstProblem =
      'Posições › carro 17 (linha 1) › Última volta: não consegui ler "ultima_volta": "4m38s" não é um tempo de volta como 4:38.293, 278.293 ou 1:02:03.4';
    expect(result.ok ? [] : result.problems, 'both problems must be listed').toHaveLength(2);
    expect(result.ok ? '' : result.summary, 'one more problem reads in the singular').toBe(
      `${firstProblem} (e mais 1 problema)`,
    );
  });
});

describe('responses and lists that are not there', () => {
  it('reports a missing response instead of mapping an empty one', () => {
    // Arrange: the preset, but the responses of the poll carry nothing for "classificacao".
    const mappings = readExampleMappings();

    // Act: map with no responses at all.
    const result = applyFlexMapping(mappings, {}, pollMomentMs);

    // Assert: one problem per shape that reads that request.
    expect(result, 'a shape whose response is missing must fail the mapping').toEqual({
      ok: false,
      problems: [
        'Posições: não há resposta da requisição "classificacao"',
        'Sessão: não há resposta da requisição "classificacao"',
      ],
      summary: 'Posições: não há resposta da requisição "classificacao" (e mais 1 problema)',
    });
  });

  it('reports a response whose list of cars is gone', () => {
    // Arrange: a response where the timing system sent its cars as an object, not a list.
    const response = readExampleResponse();
    const responseWithoutList = { ...response, classificacao: { total: 20 } };
    const mappings = readExampleMappings();

    // Act: map it.
    const result = applyFlexMapping(mappings, { classificacao: responseWithoutList }, pollMomentMs);

    // Assert: the positions problem names the list's path and the request.
    expect(result.ok ? [] : result.problems, 'a missing list must be a problem').toEqual([
      'Posições: não há uma lista em "classificacao" na resposta de classificacao',
    ]);
  });
});

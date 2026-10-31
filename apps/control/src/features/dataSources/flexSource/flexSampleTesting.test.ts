/**
 * "Testar" on the flex form, without the page (apps/control)
 *
 * What this module is for:
 *   "Testar" runs, in the browser, what the server runs at every poll of a flex source:
 *   the shared applyFlexMapping on the responses, then validateDataShape on every shape.
 *   The samples are text (pasted, or fetched with "Buscar da fonte"), so reading them as
 *   JSON comes first, and a missing or broken sample is named by its request.
 *
 * What these tests prove:
 *   - The example preset on the example response gives the 20 cars and the session.
 *   - A missing sample and a sample that is not JSON are named by their request.
 *   - One unreadable lap time fails the test, naming the car, the line and the path.
 *   - A required field the mapping leaves out is named by the shape validation.
 *
 * What these tests deliberately do not cover:
 *   - Every rule of the mapping: packages/shared/src/flexMapping/applyFlexMapping.test.ts.
 *   - The panel on the page: DataSourcesPageFlexTest.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import { testFlexMappingOnSamples } from './flexSampleTesting';
import {
  readExampleTimingSystemConfig,
  readExampleTimingSystemResponse,
  readExampleTimingSystemResponseText,
} from './timingSystemExample.testSupport';

// The moment the operator pressed "Testar": Saturday 20 March 2027, 14:24:01 in Brasília.
const momentOfTheTestMs = 1_805_563_441_000;

describe('testFlexMappingOnSamples', () => {
  it('gives the 20 cars and the session from the example response', () => {
    // Arrange: the example preset and its response, pasted as text.
    const mappings = readExampleTimingSystemConfig().mappings;
    const sampleTextByRequestId = { classificacao: readExampleTimingSystemResponseText() };

    // Act: test the mapping on the sample.
    const result = testFlexMappingOnSamples(mappings, sampleTextByRequestId, momentOfTheTestMs);

    // Assert: both shapes pass; the leader is car 17 of Acauã Baja, stamped at the test.
    expect(result.isPassing, 'the example preset must map its own example').toBe(true);
    const shapes = result.isPassing ? result.shapes : {};
    expect(shapes.positions?.entries, 'every car of the response must be listed').toHaveLength(20);
    expect(shapes.positions?.entries[0], 'the first car in the list is the leader').toMatchObject({
      position: 1,
      carNumber: 17,
      teamName: 'Acauã Baja',
      status: 'running',
    });
    expect(
      shapes.positions?.updatedAtMs,
      'positions are stamped with the moment of the test, as a poll is',
    ).toBe(momentOfTheTestMs);
    expect(shapes.session?.sessionName, 'the session must be mapped too').toBe(
      'Enduro de Resistência',
    );
  });

  it('names the request whose sample is missing, and the one that is not JSON', () => {
    // Arrange: the example preset with no sample, then with a sample cut in half.
    const mappings = readExampleTimingSystemConfig().mappings;
    const cutSample = readExampleTimingSystemResponseText().slice(0, 200);

    // Act: test with each.
    const withoutSample = testFlexMappingOnSamples(mappings, {}, momentOfTheTestMs);
    const withCutSample = testFlexMappingOnSamples(
      mappings,
      { classificacao: cutSample },
      momentOfTheTestMs,
    );

    // Assert: each says which request's sample is the trouble.
    expect(withoutSample, 'a missing sample must be named by its request').toEqual({
      isPassing: false,
      isRefusedByAFlag: false,
      problems: [
        'Falta a resposta de exemplo de classificacao: busque da fonte ou cole um exemplo.',
      ],
    });
    expect(withCutSample, 'a sample that is not JSON must be named by its request').toEqual({
      isPassing: false,
      isRefusedByAFlag: false,
      problems: ['A resposta de exemplo de classificacao não é JSON válido.'],
    });
  });

  it('fails on one unreadable lap time, naming the car, the line and the path', () => {
    // Arrange: the example response with the third car's last lap typed as "4:3x.293".
    const response = readExampleTimingSystemResponse();
    const thirdCar = response.classificacao[2] as Record<string, unknown>;
    thirdCar.ultima_volta = '4:3x.293';
    const thirdCarNumber = Number(thirdCar.carro);

    // Act: test the example preset on it.
    const result = testFlexMappingOnSamples(
      readExampleTimingSystemConfig().mappings,
      { classificacao: JSON.stringify(response) },
      momentOfTheTestMs,
    );

    // Assert: one problem line pointing at that car's lap time.
    expect(result.isPassing, 'one unreadable lap time must fail the whole test').toBe(false);
    const problems = result.isPassing ? [] : result.problems;
    expect(problems, 'one line for the one unreadable value').toHaveLength(1);
    expect(problems[0], 'the line must name the car, the line and the path').toContain(
      `Posições › carro ${thirdCarNumber} (linha 3) › Última volta: não consegui ler "ultima_volta"`,
    );
  });

  it('names a required field the mapping leaves out, through the shape validation', () => {
    // Arrange: the example preset without its rule for the team's name.
    const config = readExampleTimingSystemConfig();
    const positionsMapping = config.mappings.find((mapping) => mapping.shapeKey === 'positions');
    if (positionsMapping?.entryFields === undefined) {
      throw new Error('the example preset maps positions');
    }
    positionsMapping.entryFields = positionsMapping.entryFields.filter(
      (rule) => rule.targetField !== 'teamName',
    );

    // Act: test it on the example response.
    const result = testFlexMappingOnSamples(
      config.mappings,
      { classificacao: readExampleTimingSystemResponseText() },
      momentOfTheTestMs,
    );

    // Assert: the validation names the first car's missing team.
    expect(result.isPassing, 'positions without team names must not pass').toBe(false);
    expect(
      result.isPassing ? [] : result.problems,
      "the problem must point at the first car's team name",
    ).toEqual([expect.stringContaining('positions.entries.0.teamName')]);
  });
});

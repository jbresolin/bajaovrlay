/**
 * How many steps a graphic has, and the next one (packages/shared)
 *
 * What this module is for:
 *   An OGraf graphic may show itself in steps: the podium's head first, then its 3rd, 2nd
 *   and 1st place, one per "Próximo" (BAJAOVRLAY-47). Its manifest says how many with
 *   `stepCount`. readStepCountOfGraphic reads that number, and findNextStepOfInstance
 *   says where "Próximo" takes an instance, or that it is on its last step. The server
 *   (nextOnLayer) and the control page (the button on a Camadas row) read the same rule.
 *   A bracket's steps depend on its rounds (BAJAOVRLAY-25): its manifest says -1 and names
 *   a step counter, and readStepCountOfInstance counts them from the instance's data.
 *
 * What these tests prove:
 *   - The podium's 4 steps are read as 4; a manifest with no stepCount, OGraf's -1, a 0,
 *     a fraction and a text all read as 1, and so does a graphic the server does not list.
 *   - The podium goes 0 → 1 → 2 → 3 and has no step after 3; a graphic of one step has
 *     none after 0.
 *   - A bracket instance counts its steps from its rounds (3 for 8 cars, 7 for the real
 *     Super Prime), and has no step after its last; -1 with an unknown counter, or a
 *     counter with a fixed stepCount, reads the manifest as before; data with no rounds
 *     counts 1.
 *
 * What these tests deliberately do not cover:
 *   - The command's refusals and what it changes; the server's nextOnLayer tests.
 *   - Playing the step on screen; the renderer's tests.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { Graphic } from '../slices/graphic.js';
import type { Instance } from '../slices/instance.js';
import {
  findNextStepOfInstance,
  readStepCountOfGraphic,
  readStepCountOfInstance,
} from './graphicSteps.js';

/** The podium as the server lists it, with the manifest's stepCount given (or none). */
function buildPodiumGraphicWithStepCount(stepCount: unknown): Graphic {
  const manifest: Graphic['manifest'] = { id: 'baja-podium', name: 'Pódio', main: 'podium.js' };
  if (stepCount !== undefined) {
    manifest.stepCount = stepCount;
  }
  return {
    id: 'podium',
    manifest,
    defaultLayerId: 'fullscreen',
    category: 'standings',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The podium on air on the fullscreen layer, at the step given. */
function buildPodiumOnAirAtStep(currentStep: number): Instance {
  return {
    id: 'instancia-podio',
    layerId: 'fullscreen',
    graphicId: 'podium',
    target: 'program',
    resolvedData: { title: 'PÓDIO' },
    currentStep,
    status: 'on-air',
    takenAt: '2026-11-14T19:30:00.000Z',
  };
}

describe('readStepCountOfGraphic', () => {
  const stepCountScenarios = [
    // The podium: the head, then one step per place.
    { name: 'reads the podium’s 4 steps', stepCount: 4, expected: 4 },
    // Most graphics: OGraf's default when the manifest says nothing.
    { name: 'reads 1 when the manifest gives no stepCount', stepCount: undefined, expected: 1 },
    // OGraf's "not known in advance": the server cannot offer a step it cannot count.
    { name: 'reads 1 for OGraf’s -1', stepCount: -1, expected: 1 },
    // A graphic with no step at all would be nothing on screen.
    { name: 'reads 1 for a 0', stepCount: 0, expected: 1 },
    // Half a step is a typo.
    { name: 'reads 1 for a fraction', stepCount: 2.5, expected: 1 },
    // A number written as text is a typo too.
    { name: 'reads 1 for a text', stepCount: '4', expected: 1 },
  ];

  it.each(stepCountScenarios)('$name', ({ stepCount, expected }) => {
    // Arrange: the podium with this row's stepCount.
    const graphic = buildPodiumGraphicWithStepCount(stepCount);

    // Act: read its step count.
    const stepCountRead = readStepCountOfGraphic(graphic);

    // Assert: the count of this row.
    expect(stepCountRead, 'the step count must be read as this row says').toBe(expected);
  });

  it('reads 1 for a graphic the server does not list', () => {
    // Arrange: no graphic (its package was removed since the take).

    // Act: read its step count.
    const stepCountRead = readStepCountOfGraphic(undefined);

    // Assert: one step, so no "Próximo" is offered.
    expect(stepCountRead, 'an unknown graphic has one step').toBe(1);
  });
});

describe('findNextStepOfInstance', () => {
  const nextStepScenarios = [
    // Entrar showed the head; the first Próximo reveals the 3rd place.
    { name: 'takes the podium from its head to step 1', currentStep: 0, expected: 1 },
    // The second Próximo reveals the 2nd place.
    { name: 'takes the podium from step 1 to step 2', currentStep: 1, expected: 2 },
    // The third reveals the winner.
    { name: 'takes the podium from step 2 to step 3', currentStep: 2, expected: 3 },
    // All three places are up: nothing comes next, "Limpar" takes it off.
    { name: 'has no step after the podium’s last', currentStep: 3, expected: undefined },
  ];

  it.each(nextStepScenarios)('$name', ({ currentStep, expected }) => {
    // Arrange: the podium on air at this row's step.
    const instance = buildPodiumOnAirAtStep(currentStep);

    // Act: find where "Próximo" takes it.
    const nextStep = findNextStepOfInstance(instance, buildPodiumGraphicWithStepCount(4));

    // Assert: the step of this row, or none.
    expect(nextStep, 'Próximo must go to this step').toBe(expected);
  });

  it('has no step after 0 on a graphic of one step', () => {
    // Arrange: a graphic whose manifest gives no stepCount, on air.
    const instance = buildPodiumOnAirAtStep(0);

    // Act: find where "Próximo" takes it.
    const nextStep = findNextStepOfInstance(instance, buildPodiumGraphicWithStepCount(undefined));

    // Assert: nowhere; a one-step graphic offers no "Próximo".
    expect(nextStep, 'a graphic of one step has no next step').toBeUndefined();
  });
});

/** The bracket as the server lists it: OGraf's -1 and the counter given (or none). */
function buildBracketGraphic(stepCount: unknown, stepCounter: string | undefined): Graphic {
  return {
    id: 'bracket',
    manifest: {
      id: 'baja-bracket',
      name: 'Chaveamento',
      main: 'bracket.js',
      stepCount,
      v_baja: stepCounter === undefined ? {} : { stepCounter },
    },
    defaultLayerId: 'fullscreen',
    category: 'standings',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The bracket on air at a step, showing these rounds. */
function buildBracketOnAirAtStep(currentStep: number, rounds: unknown): Instance {
  return {
    id: 'instancia-chaveamento',
    layerId: 'fullscreen',
    graphicId: 'bracket',
    target: 'program',
    resolvedData: { title: 'SUPER PRIME', rounds },
    currentStep,
    status: 'on-air',
    takenAt: '2026-10-31T18:40:00.000Z',
  };
}

/** An eight-car elimination: quarter-finals, semifinals and final, with no results. */
function buildEightCarRounds(): unknown {
  const buildRound = (name: string, matchCount: number) => ({
    name,
    matches: Array.from({ length: matchCount }, (_unused, index) => ({
      matchId: `${name}-${index}`,
    })),
  });
  return [buildRound('Quartas de final', 4), buildRound('Semifinal', 2), buildRound('Final', 1)];
}

/** The real Super Prime's rounds, from the shared sample. */
function readTheRealSuperPrimeRounds(): unknown {
  const sampleUrl = new URL('../dataShapes/samples/brackets.super-prime.json', import.meta.url);
  return (JSON.parse(readFileSync(sampleUrl, 'utf8')) as { rounds: unknown }).rounds;
}

describe('readStepCountOfInstance', () => {
  const instanceStepScenarios = [
    // The bracket of eight cars: the tree's three rounds, one step each.
    {
      name: 'counts an eight-car bracket’s 3 steps from its rounds',
      graphic: buildBracketGraphic(-1, 'bracketSteps'),
      rounds: buildEightCarRounds(),
      expected: 3,
    },
    // The real one: three boards, then quartas, semis, third place and final.
    {
      name: 'counts the real Super Prime’s 7 steps from its rounds',
      graphic: buildBracketGraphic(-1, 'bracketSteps'),
      rounds: readTheRealSuperPrimeRounds(),
      expected: 7,
    },
    // Data with no rounds yet (an optional field left out) is the head alone.
    {
      name: 'counts 1 when the data has no rounds',
      graphic: buildBracketGraphic(-1, 'bracketSteps'),
      rounds: undefined,
      expected: 1,
    },
    // A typo in the counter's name: no counter, so -1 reads 1 as it always did.
    {
      name: 'reads 1 for -1 with a counter nobody registered',
      graphic: buildBracketGraphic(-1, 'bracketStep'),
      rounds: buildEightCarRounds(),
      expected: 1,
    },
    // A fixed count wins: a counter is read only when the manifest says the count is dynamic.
    {
      name: 'reads the manifest’s fixed count even when it names a counter',
      graphic: buildBracketGraphic(2, 'bracketSteps'),
      rounds: buildEightCarRounds(),
      expected: 2,
    },
  ];

  it.each(instanceStepScenarios)('$name', ({ graphic, rounds, expected }) => {
    // Arrange: the bracket on air at its first step, with this row's manifest and rounds.
    const instance = buildBracketOnAirAtStep(0, rounds);

    // Act: count its steps.
    const stepCount = readStepCountOfInstance(instance, graphic);

    // Assert: the count of this row.
    expect(stepCount, 'the instance must have this many steps').toBe(expected);
  });

  it('has no step after the last one the rounds give, and one before it', () => {
    // Arrange: the eight-car bracket on air at its 2nd step, then at its 3rd and last.
    const graphic = buildBracketGraphic(-1, 'bracketSteps');
    const atTheSemifinals = buildBracketOnAirAtStep(1, buildEightCarRounds());
    const atTheFinal = buildBracketOnAirAtStep(2, buildEightCarRounds());

    // Act: find where "Próximo" takes each.
    const nextFromTheSemifinals = findNextStepOfInstance(atTheSemifinals, graphic);
    const nextFromTheFinal = findNextStepOfInstance(atTheFinal, graphic);

    // Assert: the final comes after the semifinals; nothing after the final.
    expect(nextFromTheSemifinals, 'Próximo goes to the final').toBe(2);
    expect(nextFromTheFinal, 'the final is the last step').toBeUndefined();
  });
});

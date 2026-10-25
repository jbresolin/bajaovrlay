/**
 * How many steps a graphic has, and the next one (packages/shared)
 *
 * What this module is for:
 *   An OGraf graphic may show itself in steps: the podium's head first, then its 3rd, 2nd
 *   and 1st place, one per "Próximo" (BAJAOVRLAY-47). Its manifest says how many with
 *   `stepCount`. readStepCountOfGraphic reads that number, and findNextStepOfInstance
 *   says where "Próximo" takes an instance, or that it is on its last step. The server
 *   (nextOnLayer) and the control page (the button on a Camadas row) read the same rule.
 *
 * What these tests prove:
 *   - The podium's 4 steps are read as 4; a manifest with no stepCount, OGraf's -1, a 0,
 *     a fraction and a text all read as 1, and so does a graphic the server does not list.
 *   - The podium goes 0 → 1 → 2 → 3 and has no step after 3; a graphic of one step has
 *     none after 0.
 *
 * What these tests deliberately do not cover:
 *   - The command's refusals and what it changes; the server's nextOnLayer tests.
 *   - Playing the step on screen; the renderer's tests.
 */
import { describe, expect, it } from 'vitest';

import type { Graphic } from '../slices/graphic.js';
import type { Instance } from '../slices/instance.js';
import { findNextStepOfInstance, readStepCountOfGraphic } from './graphicSteps.js';

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

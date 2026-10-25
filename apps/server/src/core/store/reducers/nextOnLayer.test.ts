/**
 * The nextOnLayer reducer: "Próximo" on a layer (apps/server)
 *
 * What this module is for:
 *   A graphic may come in steps: the podium shows its head at the take, then its 3rd, 2nd
 *   and 1st place, one per "Próximo" (BAJAOVRLAY-47). nextOnLayer moves the instance on
 *   the layer's program output to its next OGraf step, by raising its `currentStep`; the
 *   renderer then plays that step. How many steps a graphic has comes from its manifest's
 *   `stepCount` (the shared readStepCountOfGraphic).
 *
 * What these tests prove:
 *   - The podium on air goes from step 0 to 1, keeping its id, data and status, and the
 *     preview on the same layer is not stepped.
 *   - The podium's three Próximos bring it to step 3, and a fourth is refused with
 *     NO_NEXT_STEP: leaving the air is "Limpar".
 *   - A graphic of one step (the race clock) is refused with NO_NEXT_STEP.
 *   - A layer whose program is empty is refused with NOTHING_ON_AIR_ON_LAYER, even with
 *     something in preview; a layer that does not exist with LAYER_NOT_FOUND.
 *
 * What these tests deliberately do not cover:
 *   - Who may send it (operators, not the screens or the server's jobs): the
 *     authorisation tests.
 *   - Playing the step on screen: the renderer's reconciler and player tests.
 */
import type { Graphic, Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildRaceClockInstanceWithStatus,
  buildRaceDaySlicesWithInstances,
  contextOfTheCommand,
} from './raceDaySlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import type { SlicesChangedByCommands } from './reducerTypes.js';

/** The podium as the server lists it: four steps, the head and one per place. */
function buildPodiumGraphic(): Graphic {
  return {
    id: 'podium',
    manifest: { id: 'baja-podium', name: 'Pódio', main: 'podium.js', stepCount: 4 },
    defaultLayerId: 'fullscreen',
    category: 'standings',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The enduro's podium on the fullscreen layer, on the output and at the step given. */
function buildPodiumInstance(target: Instance['target'], currentStep: number): Instance {
  return {
    id: target === 'program' ? 'podio-no-ar' : 'podio-em-previa',
    layerId: 'fullscreen',
    graphicId: 'podium',
    target,
    resolvedData: {
      title: 'PÓDIO',
      entries: [{ position: 1, carNumber: 31, teamName: 'Acauã Baja', schoolName: 'Mauá' }],
    },
    currentStep,
    status: target === 'program' ? 'on-air' : 'loading',
    takenAt: '2026-11-14T19:30:00.000Z',
  };
}

/** A race day with the podium registered and the instances given. */
function buildRaceDayWithThePodium(instances: Instance[]): SlicesChangedByCommands {
  const slices = buildRaceDaySlicesWithInstances(instances);
  return { ...slices, graphics: [...slices.graphics, buildPodiumGraphic()] };
}

/** The step of the program instance on the fullscreen layer after an outcome. */
function readStepOnAirOfThePodium(slices: SlicesChangedByCommands): number | undefined {
  return slices.instances.find(
    (instance) => instance.layerId === 'fullscreen' && instance.target === 'program',
  )?.currentStep;
}

describe('nextOnLayer', () => {
  it('moves the podium on air to its next step and leaves its preview alone', () => {
    // Arrange: the podium on air at its head, and another podium in preview on the layer.
    const slicesBefore = buildRaceDayWithThePodium([
      buildPodiumInstance('program', 0),
      buildPodiumInstance('preview', 0),
    ]);

    // Act: press Próximo on the fullscreen layer.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'nextOnLayer', layerId: 'fullscreen' },
      contextOfTheCommand,
    );

    // Assert: the program instance at step 1, otherwise unchanged; the preview at 0.
    const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : [];
    expect(instancesAfter, 'only the program instance moves on, to step 1').toEqual([
      { ...buildPodiumInstance('program', 0), currentStep: 1 },
      buildPodiumInstance('preview', 0),
    ]);
  });

  it('brings the podium to its last step in three presses, and refuses a fourth', () => {
    // Arrange: the podium on air at its head.
    let slices = buildRaceDayWithThePodium([buildPodiumInstance('program', 0)]);

    // Act: press Próximo three times, then once more.
    for (let press = 1; press <= 3; press += 1) {
      const outcome = reduceCommand(
        slices,
        { type: 'nextOnLayer', layerId: 'fullscreen' },
        contextOfTheCommand,
      );
      if (outcome.status === 'applied') {
        slices = outcome.slices;
      }
    }
    const fourthPress = reduceCommand(
      slices,
      { type: 'nextOnLayer', layerId: 'fullscreen' },
      contextOfTheCommand,
    );

    // Assert: step 3 after three presses; the fourth refused in pt-BR.
    expect(readStepOnAirOfThePodium(slices), 'three presses reveal the three places').toBe(3);
    expect(fourthPress, 'past the last step there is nothing to go to').toEqual({
      status: 'refused',
      error: {
        code: 'NO_NEXT_STEP',
        message: '"Pódio" já está no último passo em "Tela cheia". Use Limpar para tirá-lo do ar.',
      },
    });
  });

  it('refuses a graphic of one step', () => {
    // Arrange: the race clock on air; its manifest gives no stepCount.
    const slicesBefore = buildRaceDayWithThePodium([buildRaceClockInstanceWithStatus('on-air')]);

    // Act: press Próximo on the clock layer.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'nextOnLayer', layerId: 'clock' },
      contextOfTheCommand,
    );

    // Assert: refused; the clock has no steps.
    expect(outcome.status === 'refused' && outcome.error.code, 'one step, no next').toBe(
      'NO_NEXT_STEP',
    );
  });

  it('refuses a layer with nothing on air, even with a preview on it', () => {
    // Arrange: only a podium in preview on the fullscreen layer.
    const slicesBefore = buildRaceDayWithThePodium([buildPodiumInstance('preview', 0)]);

    // Act: press Próximo there.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'nextOnLayer', layerId: 'fullscreen' },
      contextOfTheCommand,
    );

    // Assert: refused, naming the layer as the operator reads it.
    expect(outcome, 'a preview is never stepped').toEqual({
      status: 'refused',
      error: {
        code: 'NOTHING_ON_AIR_ON_LAYER',
        message: 'Não há nada no ar na camada "Tela cheia".',
      },
    });
  });

  it('refuses a layer that does not exist', () => {
    // Arrange: an ordinary race day.
    const slicesBefore = buildRaceDayWithThePodium([buildPodiumInstance('program', 0)]);

    // Act: press Próximo on a layer nobody made.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'nextOnLayer', layerId: 'palco' },
      contextOfTheCommand,
    );

    // Assert: the usual refusal for an unknown layer.
    expect(outcome.status === 'refused' && outcome.error.code, 'no such layer').toBe(
      'LAYER_NOT_FOUND',
    );
  });
});

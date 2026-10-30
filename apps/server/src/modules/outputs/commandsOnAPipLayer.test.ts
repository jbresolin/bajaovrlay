/**
 * The show's commands on a layer of the PiP output (apps/server)
 *
 * What this module is for:
 *   Takes, clears, previews, "Tomar tudo", a macro's Prévia and "Próximo" all address a
 *   layer by its id, and a layer of the PiP output is a layer like any other
 *   (BAJAOVRLAY-49). The brief asks to prove that, not to assume it: each command here
 *   acts on the PiP's caption and leaves what is on program alone. `clearAll` ("Limpar
 *   tudo") empties every output, PiP included: the panic button must leave nothing on
 *   any OBS source (the plainer choice, recorded in docs/decisions.md).
 *
 * What these tests prove (on the pure reducer, through reduceCommand):
 *   - takeItem of an item on the caption puts it on air there, program untouched.
 *   - clearLayer of the caption clears it and nothing on program.
 *   - clearAll clears both outputs and every "vai limpar" mark.
 *   - previewItem then takePreview of the caption goes through the PiP's preview.
 *   - "Prévia: limpar" on the caption with a program preview: "Tomar tudo" does both.
 *   - The Prévia of a macro that clears the caption marks the caption "vai limpar".
 *   - "Próximo" moves the caption's graphic to its next step.
 *
 * What these tests deliberately do not cover:
 *   - Auto-out, a macro run, the event notice and live refresh, which need the store and
 *     its timers; pipLayerOnTheStore.test.ts.
 *   - The steps clamp: keepCurrentStepsWithinTheirStepCount reads an instance's graphic
 *     and data, never its layer; instanceStepsWithinTheirCount.test.ts covers it.
 */
import type { Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { contextOfTheLaterTake } from '../../core/store/reducers/previewSlices.testSupport.js';
import { reduceCommand } from '../../core/store/reducers/reduceCommand.js';
import {
  buildTeam42LowerThirdTakenByHand,
  contextOfTheRundownCommand,
} from '../../core/store/reducers/rundownSlices.testSupport.js';
import {
  buildCloseThePipMacro,
  buildPipCaptionItem,
  buildPipCaptionOnAir,
  buildRaceDaySlicesWithPip,
} from './outputSlices.testSupport.js';

/** Each instance as `layer:output`, to say in a few words what is where. */
function readWhereEachInstanceIs(instances: Instance[] | false): string[] {
  return instances === false
    ? []
    : instances.map((instance) => `${instance.layerId}:${instance.target}`);
}

/** The PiP caption ready to take, and team 42's lower third on air on program. */
function buildPipCaptionReadyWithProgramOnAir() {
  return buildRaceDaySlicesWithPip({
    items: [buildPipCaptionItem(0)],
    instances: [buildTeam42LowerThirdTakenByHand()],
  });
}

describe('a take and a clear on the PiP caption', () => {
  it('takeItem puts the caption on air on its layer and leaves program alone', () => {
    // Arrange: the caption item ready, program's lower third on air.
    const slicesBefore = buildPipCaptionReadyWithProgramOnAir();

    // Act: take the caption item.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-legenda-pip-baja-ufpr' },
      contextOfTheRundownCommand,
    );

    // Assert: both on air, each on its own layer.
    expect(
      readWhereEachInstanceIs(outcome.status === 'applied' && outcome.slices.instances),
      'the caption goes on air beside the program lower third',
    ).toEqual(['lower-third:program', 'legenda-pip:program']);
  });

  it('clearLayer clears the caption and nothing on program', () => {
    // Arrange: the caption and program's lower third on air.
    const slicesBefore = buildRaceDaySlicesWithPip({
      instances: [buildTeam42LowerThirdTakenByHand(), buildPipCaptionOnAir()],
    });

    // Act: "Limpar" on the caption's row.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'clearLayer', layerId: 'legenda-pip' },
      contextOfTheRundownCommand,
    );

    // Assert: only program's lower third is left.
    expect(
      readWhereEachInstanceIs(outcome.status === 'applied' && outcome.slices.instances),
      'only the caption goes',
    ).toEqual(['lower-third:program']);
  });
});

describe('clearAll, "Limpar tudo"', () => {
  it('clears every output and every mark', () => {
    // Arrange: the caption on air, program's lower third on air, the logo marked.
    const slicesBefore = buildRaceDaySlicesWithPip({
      instances: [buildTeam42LowerThirdTakenByHand(), buildPipCaptionOnAir()],
      previewClearedLayerIds: ['bug'],
    });

    // Act: the panic button.
    const outcome = reduceCommand(slicesBefore, { type: 'clearAll' }, contextOfTheRundownCommand);

    // Assert: nothing left on program or on the PiP, and no mark.
    expect(
      outcome.status === 'applied' && outcome.slices.instances,
      'the PiP is emptied as well as program',
    ).toEqual([]);
    expect(
      outcome.status === 'applied' && outcome.slices.previewClearedLayerIds,
      'no mark is left',
    ).toEqual([]);
  });
});

describe('Prévia on the PiP caption', () => {
  it('previewItem then takePreview puts the caption on air through its preview', () => {
    // Arrange: the caption item ready.
    const slicesBefore = buildPipCaptionReadyWithProgramOnAir();

    // Act: preview the caption, then "Tomar" on its row a moment later (a new instance id).
    const afterThePreview = reduceCommand(
      slicesBefore,
      { type: 'previewItem', itemId: 'item-legenda-pip-baja-ufpr', origin: 'manual' },
      contextOfTheRundownCommand,
    );
    const afterTheTake =
      afterThePreview.status === 'applied'
        ? reduceCommand(
            afterThePreview.slices,
            { type: 'takePreview', layerId: 'legenda-pip' },
            contextOfTheLaterTake,
          )
        : afterThePreview;

    // Assert: in preview after the first, on air after the second.
    expect(
      readWhereEachInstanceIs(
        afterThePreview.status === 'applied' && afterThePreview.slices.instances,
      ),
      'the caption is in preview',
    ).toEqual(['lower-third:program', 'legenda-pip:preview']);
    expect(
      readWhereEachInstanceIs(afterTheTake.status === 'applied' && afterTheTake.slices.instances),
      'the caption is on air',
    ).toEqual(['lower-third:program', 'legenda-pip:program']);
  });

  it('"Tomar tudo" clears the marked caption and takes the program preview together', () => {
    // Arrange: the caption on air and marked "vai limpar", and program's lower third in
    // preview from the podium item (a preview always comes from an item).
    const slicesBefore = buildRaceDaySlicesWithPip({
      instances: [
        buildPipCaptionOnAir(),
        {
          ...buildTeam42LowerThirdTakenByHand(),
          target: 'preview',
          itemId: 'item-podio-baja-ufpr',
        },
      ],
      previewClearedLayerIds: ['legenda-pip'],
    });

    // Act: "Tomar tudo".
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeAllPreviews' },
      contextOfTheRundownCommand,
    );

    // Assert: the caption is gone and the lower third is on air.
    expect(
      readWhereEachInstanceIs(outcome.status === 'applied' && outcome.slices.instances),
      'one press does both outputs',
    ).toEqual(['lower-third:program']);
  });

  it('the Prévia of a macro that clears the caption marks it "vai limpar"', () => {
    // Arrange: the caption on air, and "Fechar PiP", which clears it.
    const slicesBefore = buildRaceDaySlicesWithPip({
      instances: [buildPipCaptionOnAir()],
      macros: [buildCloseThePipMacro()],
    });

    // Act: "Prévia" on the macro.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'previewMacro', macroId: 'macro-fechar-pip' },
      contextOfTheRundownCommand,
    );

    // Assert: the caption is marked.
    expect(
      outcome.status === 'applied' && outcome.slices.previewClearedLayerIds,
      'Prévia shows the caption going',
    ).toEqual(['legenda-pip']);
  });
});

describe('"Próximo" on the PiP caption', () => {
  it('moves the caption to its next step', () => {
    // Arrange: the caption on air on step 1 of a lower third of three steps.
    const slicesOfOneStep = buildRaceDaySlicesWithPip({ instances: [buildPipCaptionOnAir()] });
    const slicesBefore = {
      ...slicesOfOneStep,
      graphics: slicesOfOneStep.graphics.map((graphic) =>
        graphic.id === 'team-lower-third'
          ? { ...graphic, manifest: { ...graphic.manifest, stepCount: 3 } }
          : graphic,
      ),
    };

    // Act: "Próximo" on the caption's row, pressed while it showed step 1.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'nextOnLayer', layerId: 'legenda-pip', fromStep: 0 },
      contextOfTheRundownCommand,
    );

    // Assert: the caption is on its second step.
    expect(
      outcome.status === 'applied' && outcome.slices.instances[0]?.currentStep,
      'the caption moves on',
    ).toBe(1);
  });
});

/**
 * The previewMacro reducer: a macro's "Prévia" (apps/server)
 *
 * What this module is for:
 *   A macro's "Prévia" shows on the preview output the screen as it will be when the
 *   macro has ended, so the operator can look before pressing "Tomar tudo", which then
 *   applies that end state in one cut without the waits. The reducer first throws away
 *   every preview and "will be cleared" marker, then plays the steps in order onto the
 *   preview state only:
 *   - takeItem previews the item on its layer, through the same path as previewItem
 *     (resolved as a take, marked `manual`), replacing any preview or marker there;
 *   - clearLayer marks the layer "will be cleared" and throws away its preview;
 *   - clearAll throws away every preview and marks exactly the layers that have
 *     something on program now (marking an empty layer would promise nothing);
 *   - wait is skipped.
 *   Program, the rundowns and the items are never touched. Each preview instance a macro
 *   makes gets the store's new instance id followed by a hyphen and its layer id.
 *
 * What these tests prove:
 *   - take, take, wait, take, clearLayer: Prévia holds the last item taken on the clock
 *     layer and a marker on the lower third (whose preview the clearLayer threw away);
 *     what Prévia held before is gone; program and the rundowns are the very same arrays.
 *   - clearAll marks only the layers with something on program, and throws away the
 *     marker of an earlier clearLayer on an empty layer and the previews made before it.
 *   - Waits are ignored: a macro with waits around a take ends like the take alone, and
 *     one with only waits and an empty Prévia hands back the very same slices.
 *   - A step that would be refused (an item that no longer exists, a layer that does not
 *     exist) refuses the whole preview with a pt-BR message naming the step's position
 *     and what it does; the refusal carries the reason of the step.
 *   - An unknown macro is refused with MACRO_NOT_FOUND, and any macro while one is
 *     running with MACRO_RUNNING.
 *
 * What these tests deliberately do not cover:
 *   - runMacro discarding the previews; runMacro.test.ts covers it.
 *   - Taking the previewed end state; takeAllPreviews.test.ts covers "Tomar tudo".
 */
import type { Macro, MacroRun, MacroStep } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildGreenFlagClockOnProgram,
  buildTeam42LowerThirdOnPreview,
  readLayerAndOutputOfEachInstance,
} from './previewSlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import {
  buildEnduroClockData,
  buildEnduroStartItem,
  buildRaceDaySlicesWithRundown,
  buildTeam42LowerThirdTakenByHand,
  buildTeam42ShortcutItem,
  buildYellowFlagItem,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';

const macroUnderTestId = 'macro-bandeira-amarela';

/** Builds "Bandeira amarela e tarja fora", a macro with the given steps. */
function buildYellowFlagMacro(steps: MacroStep[]): Macro {
  return { id: macroUnderTestId, label: 'Bandeira amarela e tarja fora', color: 'warning', steps };
}

/**
 * Builds the race day of these tests: the green clock and the lower third of team 42 on
 * air, the start, yellow flag and team 42 shortcut items, the given macro and runs, and
 * whatever Prévia already holds (a lower third previewed and the logo marked, unless
 * other previews and markers are given).
 */
function buildRaceDayWithTheMacro(parts: {
  macro: Macro;
  macroRuns?: MacroRun[];
  hasAnythingInPreviewBefore?: boolean;
}) {
  const hasAnythingInPreviewBefore = parts.hasAnythingInPreviewBefore ?? true;
  return buildRaceDaySlicesWithRundown({
    items: [buildEnduroStartItem(0), buildYellowFlagItem(1), buildTeam42ShortcutItem(0)],
    instances: [
      buildGreenFlagClockOnProgram(),
      buildTeam42LowerThirdTakenByHand(),
      ...(hasAnythingInPreviewBefore ? [buildTeam42LowerThirdOnPreview()] : []),
    ],
    previewClearedLayerIds: hasAnythingInPreviewBefore ? ['bug'] : [],
    macros: [parts.macro],
    macroRuns: parts.macroRuns ?? [],
  });
}

describe('previewMacro that shows the end state', () => {
  it('take, take, wait, take, clearLayer: Prévia holds the end state and program is untouched', () => {
    // Arrange: a macro that takes the start clock, the team 42 shortcut, waits, takes the
    // yellow flag on the same clock layer, and clears the lower third.
    const slicesBefore = buildRaceDayWithTheMacro({
      macro: buildYellowFlagMacro([
        { kind: 'takeItem', itemId: 'item-largada-do-enduro' },
        { kind: 'takeItem', itemId: 'item-atalho-tarja-baja-ufpr' },
        { kind: 'wait', ms: 500 },
        { kind: 'takeItem', itemId: 'item-bandeira-amarela' },
        { kind: 'clearLayer', layerId: 'lower-third' },
      ]),
    });

    // Act: press "Prévia" in the macro's ⋯ menu.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'previewMacro', macroId: macroUnderTestId },
      contextOfTheRundownCommand,
    );

    // Assert: program unchanged; Prévia holds the yellow flag on the clock layer and the
    // lower third marked; the earlier preview and the logo's marker are gone.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(outcome.status, 'the macro preview must be accepted').toBe('applied');
    expect(slicesAfter?.instances, 'Prévia must hold the end state, program as it was').toEqual([
      buildGreenFlagClockOnProgram(),
      buildTeam42LowerThirdTakenByHand(),
      {
        id: `${contextOfTheRundownCommand.newInstanceId}-clock`,
        layerId: 'clock',
        graphicId: 'race-clock',
        target: 'preview',
        resolvedData: buildEnduroClockData('yellow'),
        currentStep: 0,
        status: 'loading',
        takenAt: contextOfTheRundownCommand.now,
        previewOrigin: 'manual',
        itemId: 'item-bandeira-amarela',
      },
    ]);
    expect(slicesAfter?.previewClearedLayerIds, 'only the lower third may be marked').toEqual([
      'lower-third',
    ]);
    expect(slicesAfter?.rundowns, 'a preview must never move a cursor').toBe(slicesBefore.rundowns);
    expect(slicesAfter?.items, 'a preview must never change an item').toBe(slicesBefore.items);
  });

  it('clearAll marks only the layers with something on program, and nothing else', () => {
    // Arrange: a macro that clears the empty ticker, previews the yellow flag, then
    // clears everything.
    const slicesBefore = buildRaceDayWithTheMacro({
      macro: buildYellowFlagMacro([
        { kind: 'clearLayer', layerId: 'ticker' },
        { kind: 'takeItem', itemId: 'item-bandeira-amarela' },
        { kind: 'clearAll' },
      ]),
    });

    // Act: press "Prévia" on the macro.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'previewMacro', macroId: macroUnderTestId },
      contextOfTheRundownCommand,
    );

    // Assert: no preview at all; the clock and lower third layers (on air now) are
    // marked, in the order of the layers; the empty ticker, logo and fullscreen are not.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      readLayerAndOutputOfEachInstance(slicesAfter?.instances),
      'clearAll must leave no preview, and program as it was',
    ).toEqual(['clock on program', 'lower-third on program']);
    expect(
      slicesAfter?.previewClearedLayerIds,
      'only the layers with something on program may be marked',
    ).toEqual(['clock', 'lower-third']);
  });
});

describe('previewMacro and waits', () => {
  it('ignores the waits around a take, ending as the take alone would', () => {
    // Arrange: a macro that waits, takes the start clock, and waits again.
    const slicesBefore = buildRaceDayWithTheMacro({
      macro: buildYellowFlagMacro([
        { kind: 'wait', ms: 500 },
        { kind: 'takeItem', itemId: 'item-largada-do-enduro' },
        { kind: 'wait', ms: 10_000 },
      ]),
    });

    // Act: press "Prévia" on the macro.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'previewMacro', macroId: macroUnderTestId },
      contextOfTheRundownCommand,
    );

    // Assert: the start clock is previewed, and nothing is marked.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      readLayerAndOutputOfEachInstance(slicesAfter?.instances),
      'the waits must change nothing',
    ).toEqual(['clock on program', 'lower-third on program', 'clock on preview']);
    expect(slicesAfter?.previewClearedLayerIds, 'no layer may be marked').toEqual([]);
  });

  it('hands back the very same slices for a macro of waits with an empty Prévia', () => {
    // Arrange: a macro of two waits, and nothing in Prévia.
    const slicesBefore = buildRaceDayWithTheMacro({
      macro: buildYellowFlagMacro([
        { kind: 'wait', ms: 500 },
        { kind: 'wait', ms: 1_000 },
      ]),
      hasAnythingInPreviewBefore: false,
    });

    // Act: press "Prévia" on the macro.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'previewMacro', macroId: macroUnderTestId },
      contextOfTheRundownCommand,
    );

    // Assert: accepted with the very same slices: nothing to save, log or broadcast.
    expect(
      outcome.status === 'applied' ? outcome.slices : undefined,
      'a preview that changes nothing must leave no trace',
    ).toBe(slicesBefore);
  });
});

describe('previewMacro that must be refused', () => {
  // "Abrir a sessão" running at its first step, for the row about a run in progress.
  const runOfAnotherMacro: MacroRun = {
    macroId: 'macro-abrir-sessao',
    startedAt: '2026-10-09T14:32:00.000Z',
    currentStep: 0,
    isStopRequested: false,
  };
  const openTheSessionMacro: Macro = {
    id: 'macro-abrir-sessao',
    label: 'Abrir a sessão',
    color: 'success',
    steps: [{ kind: 'wait', ms: 500 }],
  };

  const refusedScenarios = [
    // The second step names an item deleted after the macro was saved: the preview would
    // be a lie about the end state, so none is made.
    {
      name: 'refuses the whole preview when a step names an item that no longer exists',
      macroId: macroUnderTestId,
      slicesBefore: buildRaceDayWithTheMacro({
        macro: buildYellowFlagMacro([
          { kind: 'takeItem', itemId: 'item-largada-do-enduro' },
          { kind: 'takeItem', itemId: 'item-apagado' },
          { kind: 'clearLayer', layerId: 'lower-third' },
        ]),
      }),
      expectedError: {
        code: 'ITEM_NOT_FOUND',
        message:
          'A prévia da macro "Bandeira amarela e tarja fora" não foi feita e nada mudou: o passo 2 (pôr no ar o item "item-apagado") não pode ser mostrado. O item "item-apagado" não existe; ele pode ter sido excluído.',
      },
    },
    // A clearLayer step naming a layer nobody defined would be refused when the macro
    // runs, so its preview is refused too.
    {
      name: 'refuses the whole preview when a step clears a layer that does not exist',
      macroId: macroUnderTestId,
      slicesBefore: buildRaceDayWithTheMacro({
        macro: buildYellowFlagMacro([
          { kind: 'takeItem', itemId: 'item-bandeira-amarela' },
          { kind: 'clearLayer', layerId: 'placar' },
        ]),
      }),
      expectedError: {
        code: 'LAYER_NOT_FOUND',
        message:
          'A prévia da macro "Bandeira amarela e tarja fora" não foi feita e nada mudou: o passo 2 (limpar a camada "placar") não pode ser mostrado. A camada "placar" não existe.',
      },
    },
    // A macro deleted from another device a moment ago.
    {
      name: 'refuses a macro that does not exist',
      macroId: 'macro-apagada',
      slicesBefore: buildRaceDayWithTheMacro({ macro: buildYellowFlagMacro([]) }),
      expectedError: { code: 'MACRO_NOT_FOUND', message: 'A macro "macro-apagada" não existe.' },
    },
    // While a macro runs, Prévia would be emptied under the operator's eyes by every
    // step; a preview waits until the run ends.
    {
      name: 'refuses a macro preview while a macro is running',
      macroId: macroUnderTestId,
      slicesBefore: {
        ...buildRaceDayWithTheMacro({
          macro: buildYellowFlagMacro([{ kind: 'clearAll' }]),
          macroRuns: [runOfAnotherMacro],
        }),
        macros: [buildYellowFlagMacro([{ kind: 'clearAll' }]), openTheSessionMacro],
      },
      expectedError: {
        code: 'MACRO_RUNNING',
        message:
          'A prévia da macro "Bandeira amarela e tarja fora" não pode ser feita enquanto a macro "Abrir a sessão" está rodando.',
      },
    },
  ];

  it.each(refusedScenarios)('$name', ({ macroId, slicesBefore, expectedError }) => {
    // Arrange: the slices of this row (see the table above).

    // Act: press "Prévia" on the macro of the row.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'previewMacro', macroId },
      contextOfTheRundownCommand,
    );

    // Assert: refused with the reason of the row; a refusal carries no new slices, so
    // what Prévia held before stays as it was.
    expect(outcome, 'the macro preview must be refused with the reason of the row').toEqual({
      status: 'refused',
      error: expectedError,
    });
  });
});

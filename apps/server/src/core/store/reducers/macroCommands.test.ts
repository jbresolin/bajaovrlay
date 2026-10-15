/**
 * The macro editing reducers: createMacro, updateMacro, deleteMacro (apps/server)
 *
 * What this module is for:
 *   The control page's macro editor saves a macro with createMacro, changes its label,
 *   colour or whole list of steps with updateMacro, and removes it with deleteMacro.
 *   A macro being run is left alone: its runner works from the steps it had at the
 *   press, so editing or deleting it then is refused.
 *
 * What these tests prove:
 *   - createMacro adds the macro after the others with the id the store made; a step
 *     naming an item or layer that does not exist is accepted at save time.
 *   - updateMacro changes only what it carries, and replaces the steps as a whole; one
 *     that changes nothing hands back the same slices.
 *   - deleteMacro removes the macro.
 *   - An unknown macro (update, delete) is refused with MACRO_NOT_FOUND; updating or
 *     deleting the running macro is refused with MACRO_RUNNING. Each with pt-BR text.
 *
 * What these tests deliberately do not cover:
 *   - Running a macro; runMacro.test.ts and macroRunner.test.ts cover it.
 */
import type { Macro, MacroRun } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from './reduceCommand.js';
import {
  buildRaceDaySlicesWithRundown,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';

/** Builds "Abrir a sessão": clock on, wait half a second, bug on. */
function buildOpenTheSessionMacro(): Macro {
  return {
    id: 'macro-abrir-sessao',
    label: 'Abrir a sessão',
    color: 'success',
    steps: [
      { kind: 'takeItem', itemId: 'item-largada-do-enduro' },
      { kind: 'wait', ms: 500 },
      { kind: 'clearLayer', layerId: 'lower-third' },
    ],
  };
}

/** Builds "Fechar a sessão": clear everything. */
function buildCloseTheSessionMacro(): Macro {
  return {
    id: 'macro-fechar-sessao',
    label: 'Fechar a sessão',
    color: 'danger',
    steps: [{ kind: 'clearAll' }],
  };
}

/** Builds the run of "Abrir a sessão", started at 14:32:00 and waiting at step 1. */
function buildRunOfOpenTheSession(): MacroRun {
  return { macroId: 'macro-abrir-sessao', startedAt: '2026-10-09T14:32:00.000Z', currentStep: 1 };
}

describe('createMacro', () => {
  it('adds the macro after the others, with the id the store made', () => {
    // Arrange: one macro saved already.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [],
      macros: [buildOpenTheSessionMacro()],
    });

    // Act: save "Fechar a sessão".
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'createMacro',
        label: 'Fechar a sessão',
        color: 'danger',
        steps: [{ kind: 'clearAll' }],
      },
      contextOfTheRundownCommand,
    );

    // Assert: two macros, the new one last with the store's id; items untouched.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter?.macros, 'the new macro must come after the others').toEqual([
      buildOpenTheSessionMacro(),
      { ...buildCloseTheSessionMacro(), id: contextOfTheRundownCommand.newMacroId },
    ]);
    expect(slicesAfter?.items, 'saving a macro must not touch the items').toBe(slicesBefore.items);
  });

  it('accepts a step naming an item and a layer that do not exist, until the step runs', () => {
    // Arrange: a race day with no items at all.
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: [] });

    // Act: save a macro taking a missing item and clearing a missing layer.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'createMacro',
        label: 'Placar',
        color: 'neutral',
        steps: [
          { kind: 'takeItem', itemId: 'item-placar-geral' },
          { kind: 'clearLayer', layerId: 'placar' },
        ],
      },
      contextOfTheRundownCommand,
    );

    // Assert: saved; the steps are refused only when they run.
    expect(outcome.status, 'a macro is not checked against items and layers at save').toBe(
      'applied',
    );
  });
});

describe('updateMacro', () => {
  it('changes only the label when only the label is sent', () => {
    // Arrange: "Abrir a sessão" saved.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [],
      macros: [buildOpenTheSessionMacro()],
    });

    // Act: rename it.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'updateMacro', macroId: 'macro-abrir-sessao', label: 'Abrir o enduro' },
      contextOfTheRundownCommand,
    );

    // Assert: new label, same colour and steps.
    const macrosAfter = outcome.status === 'applied' ? outcome.slices.macros : undefined;
    expect(macrosAfter, 'only the label may change').toEqual([
      { ...buildOpenTheSessionMacro(), label: 'Abrir o enduro' },
    ]);
  });

  it('replaces the whole list of steps with the one sent', () => {
    // Arrange: "Abrir a sessão" with three steps.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [],
      macros: [buildOpenTheSessionMacro()],
    });

    // Act: send a list of one step.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'updateMacro',
        macroId: 'macro-abrir-sessao',
        steps: [{ kind: 'takeItem', itemId: 'item-logo-baja-sae' }],
      },
      contextOfTheRundownCommand,
    );

    // Assert: exactly that one step is left.
    const stepsAfter = outcome.status === 'applied' ? outcome.slices.macros[0]?.steps : undefined;
    expect(stepsAfter, 'the steps sent must replace the old ones as a whole').toEqual([
      { kind: 'takeItem', itemId: 'item-logo-baja-sae' },
    ]);
  });

  it('hands back the very same slices when nothing it carries is different', () => {
    // Arrange: "Abrir a sessão" saved.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [],
      macros: [buildOpenTheSessionMacro()],
    });

    // Act: save it again with the same colour and steps.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'updateMacro',
        macroId: 'macro-abrir-sessao',
        color: 'success',
        steps: buildOpenTheSessionMacro().steps,
      },
      contextOfTheRundownCommand,
    );

    // Assert: the same slices object, so nothing is saved, logged or sent.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter, 'an update that changes nothing must leave no trace').toBe(slicesBefore);
  });
});

describe('deleteMacro', () => {
  it('removes the macro and leaves the others', () => {
    // Arrange: two macros saved.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [],
      macros: [buildOpenTheSessionMacro(), buildCloseTheSessionMacro()],
    });

    // Act: delete "Abrir a sessão".
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'deleteMacro', macroId: 'macro-abrir-sessao' },
      contextOfTheRundownCommand,
    );

    // Assert: only "Fechar a sessão" is left.
    const macrosAfter = outcome.status === 'applied' ? outcome.slices.macros : undefined;
    expect(macrosAfter, 'only the deleted macro may go').toEqual([buildCloseTheSessionMacro()]);
  });
});

const refusedEditScenarios = [
  // A macro deleted from another device a moment ago.
  {
    name: 'refuses to update a macro that does not exist',
    command: { type: 'updateMacro' as const, macroId: 'macro-apagada', label: 'Pódio' },
    expectedError: { code: 'MACRO_NOT_FOUND', message: 'A macro "macro-apagada" não existe.' },
  },
  // The same for a delete.
  {
    name: 'refuses to delete a macro that does not exist',
    command: { type: 'deleteMacro' as const, macroId: 'macro-apagada' },
    expectedError: { code: 'MACRO_NOT_FOUND', message: 'A macro "macro-apagada" não existe.' },
  },
  // The runner works from the steps it had at the press; changing them mid-run would
  // make the button say one thing while the screen does another.
  {
    name: 'refuses to update the macro that is running',
    command: { type: 'updateMacro' as const, macroId: 'macro-abrir-sessao', label: 'Abrir' },
    expectedError: {
      code: 'MACRO_RUNNING',
      message:
        'A macro "Abrir a sessão" está rodando agora. Espere ela terminar para alterá-la ou excluí-la.',
    },
  },
  // Deleting it mid-run would leave a running button with no macro behind it.
  {
    name: 'refuses to delete the macro that is running',
    command: { type: 'deleteMacro' as const, macroId: 'macro-abrir-sessao' },
    expectedError: {
      code: 'MACRO_RUNNING',
      message:
        'A macro "Abrir a sessão" está rodando agora. Espere ela terminar para alterá-la ou excluí-la.',
    },
  },
];

describe('updateMacro and deleteMacro, when they must be refused', () => {
  it.each(refusedEditScenarios)('$name', ({ command, expectedError }) => {
    // Arrange: "Abrir a sessão" saved and running.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [],
      macros: [buildOpenTheSessionMacro()],
      macroRuns: [buildRunOfOpenTheSession()],
    });

    // Act: try this row's command.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheRundownCommand);

    // Assert: refused with this row's code and pt-BR message.
    expect(outcome, 'this edit must be refused with its reason').toEqual({
      status: 'refused',
      error: expectedError,
    });
  });
});

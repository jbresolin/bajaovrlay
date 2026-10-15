/**
 * The runMacro reducer and the runner's bookkeeping, advanceMacroRun and endMacroRun
 * (apps/server)
 *
 * What this module is for:
 *   One press of a macro's button sends runMacro. Its reducer does not run any step:
 *   it only records the run in the `macroRuns` slice (which macro, since when, at step
 *   0). The server's macro runner sees that entry and sends each step as a command of
 *   its own, moving the run on with advanceMacroRun and closing it with endMacroRun, so
 *   the slice changes only through commands.
 *
 * What these tests prove:
 *   - runMacro records { macroId, startedAt: the command's moment, currentStep: 0 } and
 *     changes nothing else (nothing goes on air in the reducer).
 *   - runMacro is refused while any macro is running, the same one included, with
 *     MACRO_RUNNING and a pt-BR message naming both; an unknown macro with MACRO_NOT_FOUND.
 *   - advanceMacroRun sets the current step; endMacroRun removes the entry.
 *   - Either of them about a macro that is not running, or an advance to the step the
 *     run is already at, hands back the same slices (answered ok, leaves no trace).
 *
 * What these tests deliberately do not cover:
 *   - The runner itself (order, wait, failure); macroRunner.test.ts and
 *     macroRunnerWhenAStepGoesWrong.test.ts cover it.
 *   - That only the runner may send the bookkeeping; the authorisation tests cover it.
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
      { kind: 'takeItem', itemId: 'item-logo-baja-sae' },
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

/** Builds the run of "Abrir a sessão", started at 14:32:00, at the given step. */
function buildRunOfOpenTheSession(currentStep: number): MacroRun {
  return { macroId: 'macro-abrir-sessao', startedAt: '2026-10-09T14:32:00.000Z', currentStep };
}

/** Builds the race day with both macros saved and the given runs. */
function buildSlicesWithBothMacros(macroRuns: MacroRun[]) {
  return buildRaceDaySlicesWithRundown({
    items: [],
    macros: [buildOpenTheSessionMacro(), buildCloseTheSessionMacro()],
    macroRuns,
  });
}

describe('runMacro', () => {
  it('records the run at step 0 with the moment of the command, and nothing else', () => {
    // Arrange: both macros saved, none running.
    const slicesBefore = buildSlicesWithBothMacros([]);

    // Act: press "Abrir a sessão".
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'runMacro', macroId: 'macro-abrir-sessao' },
      contextOfTheRundownCommand,
    );

    // Assert: one run recorded; nothing on air yet, the macros untouched.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter?.macroRuns, 'the run must start at step 0, at the command moment').toEqual([
      { macroId: 'macro-abrir-sessao', startedAt: '2026-10-09T14:32:05.000Z', currentStep: 0 },
    ]);
    expect(slicesAfter?.instances, 'the reducer must not run any step itself').toBe(
      slicesBefore.instances,
    );
    expect(slicesAfter?.macros, 'running a macro must not change the macros').toBe(
      slicesBefore.macros,
    );
  });

  const refusedRunScenarios = [
    // One macro at a time: two would interleave their steps on the same layers.
    {
      name: 'refuses a macro while another macro is running',
      macroId: 'macro-fechar-sessao',
      macroRuns: [buildRunOfOpenTheSession(1)],
      expectedError: {
        code: 'MACRO_RUNNING',
        message:
          'A macro "Fechar a sessão" não pode começar enquanto a macro "Abrir a sessão" está rodando.',
      },
    },
    // A second press of the same button while it runs: refused the same way.
    {
      name: 'refuses the same macro while it is running',
      macroId: 'macro-abrir-sessao',
      macroRuns: [buildRunOfOpenTheSession(1)],
      expectedError: {
        code: 'MACRO_RUNNING',
        message:
          'A macro "Abrir a sessão" não pode começar enquanto a macro "Abrir a sessão" está rodando.',
      },
    },
    // A macro deleted from another device a moment ago.
    {
      name: 'refuses a macro that does not exist',
      macroId: 'macro-apagada',
      macroRuns: [],
      expectedError: { code: 'MACRO_NOT_FOUND', message: 'A macro "macro-apagada" não existe.' },
    },
  ];

  it.each(refusedRunScenarios)('$name', ({ macroId, macroRuns, expectedError }) => {
    // Arrange: both macros saved, and this row's runs.
    const slicesBefore = buildSlicesWithBothMacros(macroRuns);

    // Act: press this row's macro.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'runMacro', macroId },
      contextOfTheRundownCommand,
    );

    // Assert: refused with this row's code and pt-BR message.
    expect(outcome, 'this run must be refused with its reason').toEqual({
      status: 'refused',
      error: expectedError,
    });
  });
});

describe('advanceMacroRun and endMacroRun', () => {
  it('moves the run on to the step the runner names', () => {
    // Arrange: "Abrir a sessão" running at step 1 (the wait).
    const slicesBefore = buildSlicesWithBothMacros([buildRunOfOpenTheSession(1)]);

    // Act: the runner says the run is at step 2.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'advanceMacroRun', macroId: 'macro-abrir-sessao', currentStep: 2 },
      contextOfTheRundownCommand,
    );

    // Assert: the same run, now at step 2.
    const runsAfter = outcome.status === 'applied' ? outcome.slices.macroRuns : undefined;
    expect(runsAfter, 'only the current step may change').toEqual([buildRunOfOpenTheSession(2)]);
  });

  it('removes the run when it ends', () => {
    // Arrange: "Abrir a sessão" running at its last step.
    const slicesBefore = buildSlicesWithBothMacros([buildRunOfOpenTheSession(2)]);

    // Act: the runner says the run is over.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'endMacroRun', macroId: 'macro-abrir-sessao' },
      contextOfTheRundownCommand,
    );

    // Assert: no run left.
    const runsAfter = outcome.status === 'applied' ? outcome.slices.macroRuns : undefined;
    expect(runsAfter, 'an ended run must leave the slice').toEqual([]);
  });

  const unchangedBookkeepingScenarios = [
    // The runner names the step the run is already at (its first step, after runMacro).
    {
      name: 'hands back the same slices for an advance to the step the run is at',
      command: { type: 'advanceMacroRun' as const, macroId: 'macro-abrir-sessao', currentStep: 1 },
    },
    // A late advance about a macro that is not running: nothing to move.
    {
      name: 'hands back the same slices for an advance of a macro that is not running',
      command: { type: 'advanceMacroRun' as const, macroId: 'macro-fechar-sessao', currentStep: 0 },
    },
    // An end about a macro that is not running: nothing to remove.
    {
      name: 'hands back the same slices for the end of a macro that is not running',
      command: { type: 'endMacroRun' as const, macroId: 'macro-fechar-sessao' },
    },
  ];

  it.each(unchangedBookkeepingScenarios)('$name', ({ command }) => {
    // Arrange: "Abrir a sessão" running at step 1.
    const slicesBefore = buildSlicesWithBothMacros([buildRunOfOpenTheSession(1)]);

    // Act: send this row's bookkeeping.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheRundownCommand);

    // Assert: accepted, and the very same slices, so it leaves no trace.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter, 'bookkeeping that changes nothing must leave no trace').toBe(slicesBefore);
  });
});

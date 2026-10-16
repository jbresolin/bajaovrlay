/**
 * The stopMacro reducer: the operator's "Parar" (apps/server)
 *
 * What this module is for:
 *   An operator who pressed a macro by mistake, or sees it go wrong, presses "Parar"
 *   (or the key P). stopMacro does not end the run itself: a reducer is pure and the
 *   runner may be in the middle of a step. It marks the run `isStopRequested: true`;
 *   the macro runner sees the mark, sends no step after the one in progress, and ends
 *   the run with endMacroRun. Pages read the mark to show "Parando…".
 *
 * What these tests prove:
 *   - stopMacro of the running macro marks its run and changes nothing else (nothing
 *     goes off air, the current step stays).
 *   - stopMacro of a known macro that is not running, or of a run already marked, hands
 *     back the same slices (answered ok, leaves no trace).
 *   - stopMacro of an unknown macro is refused with MACRO_NOT_FOUND and a pt-BR message.
 *
 * What these tests deliberately do not cover:
 *   - What the runner does with the mark (a wait cut short, a step let finish, the lock
 *     freed): macroRunnerStop.test.ts.
 *   - Who may send stopMacro: the authorisation tests.
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

/** Builds the run of "Abrir a sessão", started at 14:32:00, waiting at step 1. */
function buildRunOfOpenTheSessionAtTheWait(isStopRequested: boolean): MacroRun {
  return {
    macroId: 'macro-abrir-sessao',
    startedAt: '2026-10-09T14:32:00.000Z',
    currentStep: 1,
    isStopRequested,
  };
}

/** Builds the race day with both macros saved and the given runs. */
function buildSlicesWithBothMacros(macroRuns: MacroRun[]) {
  return buildRaceDaySlicesWithRundown({
    items: [],
    macros: [buildOpenTheSessionMacro(), buildCloseTheSessionMacro()],
    macroRuns,
  });
}

describe('stopMacro', () => {
  it('marks the running macro’s run as asked to stop, and changes nothing else', () => {
    // Arrange: "Abrir a sessão" running, waiting at step 1.
    const slicesBefore = buildSlicesWithBothMacros([buildRunOfOpenTheSessionAtTheWait(false)]);

    // Act: the operator presses "Parar".
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'stopMacro', macroId: 'macro-abrir-sessao' },
      contextOfTheRundownCommand,
    );

    // Assert: the same run, at the same step, now marked; nothing taken off air.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter?.macroRuns, 'only the stop mark may change').toEqual([
      buildRunOfOpenTheSessionAtTheWait(true),
    ]);
    expect(slicesAfter?.instances, 'stopping a macro must not take anything off air').toBe(
      slicesBefore.instances,
    );
  });

  const unchangedStopScenarios = [
    // "Parar" pressed on a page that has not yet seen the run end: nothing to stop.
    {
      name: 'hands back the same slices for a macro that is not running',
      macroId: 'macro-fechar-sessao',
      macroRuns: [buildRunOfOpenTheSessionAtTheWait(false)],
    },
    // No run at all, as after a restart.
    {
      name: 'hands back the same slices when no macro is running',
      macroId: 'macro-abrir-sessao',
      macroRuns: [],
    },
    // "Parar" pressed twice, or by two operators: the run is already marked.
    {
      name: 'hands back the same slices for a run already asked to stop',
      macroId: 'macro-abrir-sessao',
      macroRuns: [buildRunOfOpenTheSessionAtTheWait(true)],
    },
  ];

  it.each(unchangedStopScenarios)('$name', ({ macroId, macroRuns }) => {
    // Arrange: both macros saved, and this row's runs.
    const slicesBefore = buildSlicesWithBothMacros(macroRuns);

    // Act: press "Parar" for this row's macro.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'stopMacro', macroId },
      contextOfTheRundownCommand,
    );

    // Assert: accepted, and the very same slices, so it leaves no trace.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter, 'a stop that changes nothing must leave no trace').toBe(slicesBefore);
  });

  it('refuses a macro that does not exist', () => {
    // Arrange: both macros saved, "Abrir a sessão" running.
    const slicesBefore = buildSlicesWithBothMacros([buildRunOfOpenTheSessionAtTheWait(false)]);

    // Act: stop a macro deleted from another device a moment ago.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'stopMacro', macroId: 'macro-apagada' },
      contextOfTheRundownCommand,
    );

    // Assert: refused with MACRO_NOT_FOUND and its pt-BR message.
    expect(outcome, 'an unknown macro must be refused with its reason').toEqual({
      status: 'refused',
      error: { code: 'MACRO_NOT_FOUND', message: 'A macro "macro-apagada" não existe.' },
    });
  });
});

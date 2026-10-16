/**
 * Macros, their steps, their runs and their commands (packages/shared)
 *
 * What this module is for:
 *   A macro is one button that does several things in a row ("Abrir a sessão": clock on,
 *   bug on). Its steps are a list told apart by `kind`: take an item, clear a layer,
 *   clear everything, or wait a number of milliseconds before the next step. The
 *   `macros` slice holds the macros; the `macroRuns` slice says which macro is running
 *   and at which step, so its button can show it. Operators create, update, delete and
 *   run macros; the server's runner moves a run on and ends it with two commands of its
 *   own.
 *
 * What these tests prove:
 *   - Each of the four kinds of step is accepted unchanged; an unknown kind, or a step
 *     missing what it names, is refused.
 *   - A wait is whole milliseconds from 1 to 10 000 (bounds checked row by row).
 *   - A macro and a run are accepted unchanged; a macro needs a label and a known colour;
 *     a run always says whether the operator asked to stop it (isStopRequested).
 *   - createMacro fills in the neutral colour; updateMacro may carry any one part;
 *     deleteMacro, runMacro and stopMacro need the macro; advanceMacroRun and endMacroRun
 *     need the macro, and advanceMacroRun a whole step number from 0.
 *
 * What these tests deliberately do not cover:
 *   - Whether the item or layer a step names exists: a macro is accepted at save time
 *     and a step naming something missing is refused when the step runs (apps/server).
 *   - Who may send which command, and the runner itself; apps/server covers both.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CommandSchema } from '../commands/command.js';
import { MacroSchema } from './macro.js';
import { MacroRunSchema } from './macroRun.js';
import { MacroStepSchema } from './macroStep.js';

/** Builds the macro "Abrir a sessão": clock on, wait half a second, bug on. */
function buildOpenTheSessionMacro() {
  return {
    id: 'macro-abrir-sessao',
    label: 'Abrir a sessão',
    color: 'success',
    steps: [
      { kind: 'takeItem', itemId: 'item-relogio-do-enduro' },
      { kind: 'wait', ms: 500 },
      { kind: 'takeItem', itemId: 'item-logo-baja-sae' },
    ],
  };
}

describe('MacroStepSchema', () => {
  const acceptedStepScenarios = [
    // Put a prepared item on air, exactly as its button would.
    { name: 'accepts a takeItem step', step: { kind: 'takeItem', itemId: 'item-logo-baja-sae' } },
    // Empty one layer, as its "Limpar" button would.
    { name: 'accepts a clearLayer step', step: { kind: 'clearLayer', layerId: 'lower-third' } },
    // Empty every layer; the step carries nothing else.
    { name: 'accepts a clearAll step', step: { kind: 'clearAll' } },
    // Hold the next step back by two seconds.
    { name: 'accepts a wait step', step: { kind: 'wait', ms: 2_000 } },
  ];

  it.each(acceptedStepScenarios)('$name', ({ step }) => {
    // Arrange: the step of this row (built above).

    // Act: check it.
    const result = MacroStepSchema.safeParse(step);

    // Assert: accepted unchanged.
    expect(result.success, 'this step must be accepted').toBe(true);
    expect(result.data, 'the accepted step must not be altered').toEqual(step);
  });

  const waitBoundScenarios = [
    // A wait of nothing is not a wait; it would only hide a typo.
    { name: 'refuses a wait of 0 ms', ms: 0, isAccepted: false },
    // The shortest wait there is.
    { name: 'accepts a wait of 1 ms', ms: 1, isAccepted: true },
    // The longest wait the brief allows: ten seconds.
    { name: 'accepts a wait of 10 000 ms', ms: 10_000, isAccepted: true },
    // One millisecond past the limit; a longer pause belongs to the operator, not a macro.
    { name: 'refuses a wait of 10 001 ms', ms: 10_001, isAccepted: false },
    // Milliseconds are whole; a fraction is a client bug.
    { name: 'refuses a wait of 1.5 ms', ms: 1.5, isAccepted: false },
  ];

  it.each(waitBoundScenarios)('$name', ({ ms, isAccepted }) => {
    // Arrange: a wait step of this row's length.
    const waitStep = { kind: 'wait', ms };

    // Act: check it.
    const result = MacroStepSchema.safeParse(waitStep);

    // Assert: accepted or refused as the row says.
    expect(result.success, 'a wait must be whole milliseconds from 1 to 10 000').toBe(isAccepted);
  });

  const refusedStepScenarios = [
    // OBS scene steps arrive in M4; until then the kind does not exist.
    { name: 'refuses a step of a kind that does not exist', step: { kind: 'obsScene' } },
    // A take that names no item would take nothing.
    { name: 'refuses a takeItem step without the item', step: { kind: 'takeItem' } },
    // A clear that names no layer would clear nothing.
    { name: 'refuses a clearLayer step without the layer', step: { kind: 'clearLayer' } },
  ];

  it.each(refusedStepScenarios)('$name', ({ step }) => {
    // Arrange: the step of this row (built above).

    // Act: check it.
    const result = MacroStepSchema.safeParse(step);

    // Assert: refused.
    expect(result.success, 'this step must be refused').toBe(false);
  });
});

describe('MacroSchema and MacroRunSchema', () => {
  it('accepts the macro "Abrir a sessão" unchanged', () => {
    // Arrange: clock on, wait half a second, bug on.
    const openTheSessionMacro = buildOpenTheSessionMacro();

    // Act: check it.
    const result = MacroSchema.safeParse(openTheSessionMacro);

    // Assert: accepted exactly as written.
    expect(result.success, 'a realistic macro must be accepted').toBe(true);
    expect(result.data, 'the accepted macro must not be altered').toEqual(openTheSessionMacro);
  });

  it('refuses a macro whose colour is not one of the six item colours, naming the field', () => {
    // Arrange: the same macro painted with a colour value instead of a colour name.
    const macroWithRawColour = { ...buildOpenTheSessionMacro(), color: '#00ff00' };

    // Act: check it and turn the failure into readable text.
    const result = MacroSchema.safeParse(macroWithRawColour);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: refused, naming the colour.
    expect(result.success, 'a macro colour must be one of the six names').toBe(false);
    expect(failureMessage, 'the failure must name the bad field').toContain('color');
  });

  it('accepts a run of "Abrir a sessão" at its second step, unchanged', () => {
    // Arrange: the run started at 14:32:05 and is now waiting (step 1, counted from 0).
    const runAtTheWait = {
      macroId: 'macro-abrir-sessao',
      startedAt: '2026-10-09T14:32:05.000Z',
      currentStep: 1,
      isStopRequested: false,
    };

    // Act: check it.
    const result = MacroRunSchema.safeParse(runAtTheWait);

    // Assert: accepted exactly as written.
    expect(result.success, 'a run at its second step must be accepted').toBe(true);
    expect(result.data, 'the accepted run must not be altered').toEqual(runAtTheWait);
  });

  it('accepts a run the operator asked to stop, unchanged', () => {
    // Arrange: the same run, after "Parar" was pressed during the wait.
    const runBeingStopped = {
      macroId: 'macro-abrir-sessao',
      startedAt: '2026-10-09T14:32:05.000Z',
      currentStep: 1,
      isStopRequested: true,
    };

    // Act: check it.
    const result = MacroRunSchema.safeParse(runBeingStopped);

    // Assert: accepted exactly as written, so a page can show "Parando…".
    expect(result.success, 'a run being stopped must be accepted').toBe(true);
    expect(result.data, 'the stop request must be kept as written').toEqual(runBeingStopped);
  });

  it('refuses a run that does not say whether a stop was asked for', () => {
    // Arrange: a run written before stopMacro existed.
    const runWithoutStopRequest = {
      macroId: 'macro-abrir-sessao',
      startedAt: '2026-10-09T14:32:05.000Z',
      currentStep: 1,
    };

    // Act: check it and turn the failure into readable text.
    const result = MacroRunSchema.safeParse(runWithoutStopRequest);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: refused, naming the missing field.
    expect(result.success, 'every run must say whether a stop was asked for').toBe(false);
    expect(failureMessage, 'the failure must name the missing field').toContain('isStopRequested');
  });
});

describe('the macro commands', () => {
  it('fills in the neutral colour when createMacro does not choose one', () => {
    // Arrange: a new macro with a label and its steps only.
    const createMacroWithoutColour = {
      type: 'createMacro',
      label: 'Abrir a sessão',
      steps: buildOpenTheSessionMacro().steps,
    };

    // Act: check it.
    const result = CommandSchema.safeParse(createMacroWithoutColour);

    // Assert: accepted, with the neutral colour and nothing else added.
    expect(result.success, 'a createMacro without a colour must be accepted').toBe(true);
    expect(result.data, 'only the colour may be filled in').toEqual({
      ...createMacroWithoutColour,
      color: 'neutral',
    });
  });

  const acceptedCommandScenarios = [
    // The editor saves only the label it changed.
    {
      name: 'accepts updateMacro with a new label only',
      command: { type: 'updateMacro', macroId: 'macro-abrir-sessao', label: 'Abrir o enduro' },
    },
    // Steps are replaced as a whole list, never patched one by one.
    {
      name: 'accepts updateMacro with a whole new list of steps',
      command: {
        type: 'updateMacro',
        macroId: 'macro-abrir-sessao',
        steps: [{ kind: 'clearAll' }],
      },
    },
    // Deleting names only the macro.
    {
      name: 'accepts deleteMacro with the macro',
      command: { type: 'deleteMacro', macroId: 'macro-abrir-sessao' },
    },
    // One press of the macro's button.
    {
      name: 'accepts runMacro with the macro',
      command: { type: 'runMacro', macroId: 'macro-abrir-sessao' },
    },
    // The runner says which step the run is at now.
    {
      name: 'accepts advanceMacroRun with the macro and the step',
      command: { type: 'advanceMacroRun', macroId: 'macro-abrir-sessao', currentStep: 2 },
    },
    // The runner says the run is over, whatever the outcome.
    {
      name: 'accepts endMacroRun with the macro',
      command: { type: 'endMacroRun', macroId: 'macro-abrir-sessao' },
    },
    // The operator's "Parar": end the run after the step in progress.
    {
      name: 'accepts stopMacro with the macro',
      command: { type: 'stopMacro', macroId: 'macro-abrir-sessao' },
    },
  ];

  it.each(acceptedCommandScenarios)('$name', ({ command }) => {
    // Arrange: the command of this row (built above).

    // Act: check it.
    const result = CommandSchema.safeParse(command);

    // Assert: accepted unchanged.
    expect(result.success, 'this macro command must be accepted').toBe(true);
    expect(result.data, 'nothing may be added to the command').toEqual(command);
  });

  const refusedCommandScenarios = [
    // A button with no label cannot be found on the grid.
    {
      name: 'refuses createMacro with an empty label',
      command: { type: 'createMacro', label: '', steps: [] },
      fieldNamed: 'label',
    },
    // A wait over the limit is refused inside a macro too, naming the step.
    {
      name: 'refuses createMacro with a wait of 20 seconds',
      command: { type: 'createMacro', label: 'Pausa longa', steps: [{ kind: 'wait', ms: 20_000 }] },
      fieldNamed: 'steps',
    },
    // Without the macro the server cannot know which button was pressed.
    {
      name: 'refuses runMacro without the macro',
      command: { type: 'runMacro' },
      fieldNamed: 'macroId',
    },
    // Nor which run "Parar" was pressed for.
    {
      name: 'refuses stopMacro without the macro',
      command: { type: 'stopMacro' },
      fieldNamed: 'macroId',
    },
    // Steps count from 0; a negative one is a runner bug.
    {
      name: 'refuses advanceMacroRun with a negative step',
      command: { type: 'advanceMacroRun', macroId: 'macro-abrir-sessao', currentStep: -1 },
      fieldNamed: 'currentStep',
    },
  ];

  it.each(refusedCommandScenarios)('$name', ({ command, fieldNamed }) => {
    // Arrange: the command of this row (built above).

    // Act: check it and turn the failure into readable text.
    const result = CommandSchema.safeParse(command);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: refused, naming the field that is wrong.
    expect(result.success, 'this macro command must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the bad field').toContain(fieldNamed);
  });
});

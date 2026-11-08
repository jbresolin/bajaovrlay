/**
 * What the Dados role may do to triggers (apps/server)
 *
 * What this module is for:
 *   Dados prepares the show but never changes what is on air (BAJAOVRLAY-29). A trigger in
 *   "auto" runs its macro on air with nobody pressing a button, so Dados may leave a
 *   trigger only in "perguntar": setting one to "auto", or switching on an auto one, is the
 *   Produtor's (gate 2 of PR #51). Dados may still edit an auto trigger and it stays auto,
 *   but not its macro or what it waits for (kind and filter). The check reads the command
 *   against the trigger as the store holds it, because the page sends the whole trigger at
 *   every save: a field sent with its stored value is no change.
 *
 * What these tests prove (each row of the tables below, on the pure check):
 *   - Which trigger creates and changes Dados may send, and which are refused with which
 *     sentence; a change is judged on the trigger as it would be after it.
 *   - Other commands, a delete among them, are not this check's to judge.
 *
 * What these tests deliberately do not cover:
 *   - Event rules and macros; authorizeRuleAndMacroAutomationByTheDataRole.test.ts.
 *   - Which command types each role may send at all; commandSenders.test.ts in shared.
 *   - The store refusing and logging, and that it asks only for Dados;
 *     storeAuthorisesAutomationByRole.test.ts in modules/triggers.
 *   - The page's greyed-out "Automático"; apps/control's dataRoleAutomation.test.tsx.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { findWhyTheDataRoleMayNotChangeThisAutomation } from './automationAndTheDataRole.js';
import {
  buildBoxEnteredTrigger,
  buildFastestLapRule,
  buildSaveOfTheWholeTrigger,
  buildSlicesHolding,
  trackReplayMacro,
} from './automationOfTheDataRole.testSupport.js';

const refusedSettingATriggerToAuto =
  'O papel Dados não pode pôr um gatilho no automático. Peça ao Produtor.';
const refusedSwitchingOnAnAutoTrigger =
  'O papel Dados não pode ligar um gatilho automático. Peça ao Produtor.';
const refusedChangingAnAutoTrigger =
  'O papel Dados não pode mexer num gatilho automático. Peça ao Produtor.';

describe('createTrigger by Dados', () => {
  const scenarios = [
    // The default, and what Dados is for: preparing a trigger the Produtor answers.
    {
      name: 'allows a trigger that asks',
      mode: 'ask' as const,
      isEnabled: true,
      refusal: undefined,
    },
    // The hole of the review: an auto trigger runs its macro on air with nobody asked.
    {
      name: 'refuses an auto trigger',
      mode: 'auto' as const,
      isEnabled: true,
      refusal: refusedSettingATriggerToAuto,
    },
    // Off today, but the Produtor's switch-on would air what Dados set up unseen.
    {
      name: 'refuses an auto trigger even when it is created off',
      mode: 'auto' as const,
      isEnabled: false,
      refusal: refusedSettingATriggerToAuto,
    },
  ];

  it.each(scenarios)('$name', ({ mode, isEnabled, refusal }) => {
    // Arrange: a store with no trigger of this name yet, and the row's new trigger.
    const slices = buildSlicesHolding(buildBoxEnteredTrigger(), buildFastestLapRule());
    const command: Command = {
      type: 'createTrigger',
      name: 'Saiu do box',
      isEnabled,
      when: { kind: 'obsScene', change: 'left', sceneName: 'Box' },
      macroId: trackReplayMacro.id,
      mode,
      minimumIntervalMs: 10_000,
    };

    // Act: ask the check about Dados's command.
    const answer = findWhyTheDataRoleMayNotChangeThisAutomation(command, slices);

    // Assert: the row's answer.
    expect(answer, 'the refusal sentence, or none when Dados may').toBe(refusal);
  });
});

describe('updateTrigger by Dados', () => {
  const askingTrigger = buildBoxEnteredTrigger();
  const autoTrigger = buildBoxEnteredTrigger({ mode: 'auto' });
  const autoTriggerSwitchedOff = buildBoxEnteredTrigger({ mode: 'auto', isEnabled: false });

  const scenarios = [
    // A trigger that asks: Dados may change anything but the mode to auto.
    {
      name: 'allows changing the macro and the scene of a trigger that asks',
      trigger: askingTrigger,
      changes: {
        macroId: trackReplayMacro.id,
        when: { kind: 'obsScene' as const, change: 'entered' as const, sceneName: 'Pista' },
      },
      refusal: undefined,
    },
    // The review's hole, by an edit rather than a create.
    {
      name: 'refuses setting a trigger that asks to auto',
      trigger: askingTrigger,
      changes: { mode: 'auto' as const },
      refusal: refusedSettingATriggerToAuto,
    },
    // The brief: Dados editing an auto trigger keeps it auto.
    {
      name: 'allows renaming an auto trigger, which stays auto',
      trigger: autoTrigger,
      changes: { name: 'Entrou no box (entrevista)' },
      refusal: undefined,
    },
    // How often it may fire is not what it puts on air: decided at gate 2, PR #51.
    {
      name: 'allows changing the interval of an auto trigger',
      trigger: autoTrigger,
      changes: { minimumIntervalMs: 30_000 },
      refusal: undefined,
    },
    // Less automation is never more on air: Dados may stop an auto trigger.
    {
      name: 'allows switching an auto trigger off',
      trigger: autoTrigger,
      changes: { isEnabled: false },
      refusal: undefined,
    },
    // The same: from now on the Produtor answers each firing.
    {
      name: 'allows setting an auto trigger back to asking, even with a new macro',
      trigger: autoTrigger,
      changes: { mode: 'ask' as const, macroId: trackReplayMacro.id },
      refusal: undefined,
    },
    // The brief: what an auto trigger runs is the Produtor's.
    {
      name: 'refuses changing the macro of an auto trigger',
      trigger: autoTrigger,
      changes: { macroId: trackReplayMacro.id },
      refusal: refusedChangingAnAutoTrigger,
    },
    // The brief: its kind, here a scene become an HTTP call.
    {
      name: 'refuses changing what kind of thing an auto trigger waits for',
      trigger: autoTrigger,
      changes: { when: { kind: 'http' as const } },
      refusal: refusedChangingAnAutoTrigger,
    },
    // The brief: its filter, here the scene's name.
    {
      name: 'refuses changing the filter of an auto trigger',
      trigger: autoTrigger,
      changes: {
        when: { kind: 'obsScene' as const, change: 'entered' as const, sceneName: 'Pista' },
      },
      refusal: refusedChangingAnAutoTrigger,
    },
    // Off or on, an auto trigger's macro is the Produtor's: switching on would air it.
    {
      name: 'refuses changing the macro of an auto trigger that is off',
      trigger: autoTriggerSwitchedOff,
      changes: { macroId: trackReplayMacro.id },
      refusal: refusedChangingAnAutoTrigger,
    },
    // The brief: switching on an auto trigger is the Produtor's.
    {
      name: 'refuses switching on an auto trigger',
      trigger: autoTriggerSwitchedOff,
      changes: { isEnabled: true },
      refusal: refusedSwitchingOnAnAutoTrigger,
    },
  ];

  it.each(scenarios)('$name', ({ trigger, changes, refusal }) => {
    // Arrange: the store holds the row's trigger; Dados saves it with the row's changes.
    const slices = buildSlicesHolding(trigger, buildFastestLapRule());
    const command = buildSaveOfTheWholeTrigger(trigger, changes);

    // Act: ask the check about Dados's save.
    const answer = findWhyTheDataRoleMayNotChangeThisAutomation(command, slices);

    // Assert: the row's answer.
    expect(answer, 'the refusal sentence, or none when Dados may').toBe(refusal);
  });

  it('allows an update that names only the name of an auto trigger', () => {
    // Arrange: an auto trigger, and an update carrying nothing but a new name.
    const slices = buildSlicesHolding(autoTrigger, buildFastestLapRule());
    const command: Command = {
      type: 'updateTrigger',
      triggerId: autoTrigger.id,
      name: 'Box: entrevista',
    };

    // Act: ask the check about it.
    const answer = findWhyTheDataRoleMayNotChangeThisAutomation(command, slices);

    // Assert: what the update leaves out stays as stored, so nothing auto changes.
    expect(answer, 'a rename alone changes nothing that goes on air').toBe(undefined);
  });

  it('leaves an unknown trigger to the reducer, which refuses it by name', () => {
    // Arrange: an update of a trigger the store does not hold.
    const slices = buildSlicesHolding(askingTrigger, buildFastestLapRule());
    const command: Command = { type: 'updateTrigger', triggerId: 'gatilho-apagado', mode: 'auto' };

    // Act: ask the check about it.
    const answer = findWhyTheDataRoleMayNotChangeThisAutomation(command, slices);

    // Assert: no answer here; the reducer's "não existe" is the clearer refusal.
    expect(answer, 'the check only judges triggers that exist').toBe(undefined);
  });
});

describe('every other command', () => {
  it('is not this check’s to judge', () => {
    // Arrange: an auto trigger, and Dados deleting it (which puts nothing on air).
    const autoTrigger = buildBoxEnteredTrigger({ mode: 'auto' });
    const slices = buildSlicesHolding(autoTrigger, buildFastestLapRule());
    const command: Command = { type: 'deleteTrigger', triggerId: autoTrigger.id };

    // Act: ask the check about it.
    const answer = findWhyTheDataRoleMayNotChangeThisAutomation(command, slices);

    // Assert: no answer; the role column already decided the command type.
    expect(answer, 'only changes that could automate the air are judged').toBe(undefined);
  });
});

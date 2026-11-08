/**
 * What the Dados role may do to event rules and to the macros of auto triggers (apps/server)
 *
 * What this module is for:
 *   Dados prepares the show but never changes what is on air (BAJAOVRLAY-29). An event rule
 *   in "auto" airs every event of its kind by itself, and an auto trigger airs its macro's
 *   steps, so (gate 2 of PR #51) Dados may leave a rule only in "perguntar" or "ignorar",
 *   may not change an auto rule's item or times, and may not change the steps of a macro
 *   an auto trigger runs. The check reads the command against the store's rules, macros
 *   and triggers, because the page sends the whole rule at every save.
 *
 * What these tests prove (each row of the tables below, on the pure check):
 *   - Which rule changes Dados may send, and which are refused with which sentence.
 *   - Which macro changes Dados may send: its steps only while no auto trigger runs it;
 *     its label and colour always.
 *
 * What these tests deliberately do not cover:
 *   - Triggers themselves; authorizeTriggerAutomationByTheDataRole.test.ts.
 *   - The store refusing and logging; storeAuthorisesAutomationByRole.test.ts.
 *   - The page's greyed-out controls; apps/control's dataRoleAutomation.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import { findWhyTheDataRoleMayNotChangeThisAutomation } from './automationAndTheDataRole.js';
import {
  buildBoxEnteredTrigger,
  buildFastestLapRule,
  buildSaveOfTheWholeRule,
  buildSlicesHolding,
  interviewInTheBoxMacro,
} from './automationOfTheDataRole.testSupport.js';

const refusedSettingARuleToAuto =
  'O papel Dados não pode pôr uma regra no automático. Peça ao Produtor.';
const refusedChangingAnAutoRule =
  'O papel Dados não pode mexer numa regra automática. Peça ao Produtor.';
const refusedChangingTheMacroOfAnAutoTrigger =
  'O papel Dados não pode mexer numa macro que um gatilho automático roda. Peça ao Produtor.';

describe('updateEventRule by Dados', () => {
  const askingRule = buildFastestLapRule();
  const autoRule = buildFastestLapRule({ mode: 'auto' });

  const scenarios = [
    // Dados prepares rules: an asking rule's item and times are its to change.
    {
      name: 'allows changing the item and times of a rule that asks',
      rule: askingRule,
      changes: { itemId: 'item-volta-mais-rapida-grande', durationMs: 12_000 },
      refusal: undefined,
    },
    // "Ignorar" puts nothing on air.
    {
      name: 'allows setting a rule that asks to ignore',
      rule: askingRule,
      changes: { mode: 'ignore' as const },
      refusal: undefined,
    },
    // The review's hole: an auto rule airs every event of its kind by itself.
    {
      name: 'refuses setting a rule to auto',
      rule: askingRule,
      changes: { mode: 'auto' as const },
      refusal: refusedSettingARuleToAuto,
    },
    // The page sends the whole row: an auto rule saved unchanged is no change.
    {
      name: 'allows saving an auto rule with nothing changed',
      rule: autoRule,
      changes: {},
      refusal: undefined,
    },
    // What an auto rule puts on air is the Produtor's.
    {
      name: 'refuses changing the item of an auto rule',
      rule: autoRule,
      changes: { itemId: 'item-volta-mais-rapida-grande' },
      refusal: refusedChangingAnAutoRule,
    },
    // How long it stays on air too.
    {
      name: 'refuses changing how long an auto rule stays on air',
      rule: autoRule,
      changes: { durationMs: 20_000 },
      refusal: refusedChangingAnAutoRule,
    },
    // And how old an event it may still air.
    {
      name: 'refuses changing the maximum wait of an auto rule',
      rule: autoRule,
      changes: { maxAgeMs: null },
      refusal: refusedChangingAnAutoRule,
    },
    // Less automation: from now on the Produtor answers each event.
    {
      name: 'allows setting an auto rule back to asking',
      rule: autoRule,
      changes: { mode: 'ask' as const, itemId: 'item-volta-mais-rapida-grande' },
      refusal: undefined,
    },
  ];

  it.each(scenarios)('$name', ({ rule, changes, refusal }) => {
    // Arrange: the store holds the row's rule; Dados saves it with the row's changes.
    const slices = buildSlicesHolding(buildBoxEnteredTrigger(), rule);
    const command = buildSaveOfTheWholeRule(rule, changes);

    // Act: ask the check about Dados's save.
    const answer = findWhyTheDataRoleMayNotChangeThisAutomation(command, slices);

    // Assert: the row's answer.
    expect(answer, 'the refusal sentence, or none when Dados may').toBe(refusal);
  });
});

describe('updateMacro by Dados', () => {
  const newSteps = [{ kind: 'takeItem' as const, itemId: 'item-patrocinador-master' }];

  const scenarios = [
    // A macro no auto trigger runs is Dados's to prepare.
    {
      name: 'allows changing the steps of a macro only an asking trigger runs',
      trigger: buildBoxEnteredTrigger(),
      command: {
        type: 'updateMacro' as const,
        macroId: interviewInTheBoxMacro.id,
        steps: newSteps,
      },
      refusal: undefined,
    },
    // Otherwise the auto trigger would air Dados's steps: the same hole, one step removed.
    {
      name: 'refuses changing the steps of a macro an auto trigger runs',
      trigger: buildBoxEnteredTrigger({ mode: 'auto' }),
      command: {
        type: 'updateMacro' as const,
        macroId: interviewInTheBoxMacro.id,
        steps: newSteps,
      },
      refusal: refusedChangingTheMacroOfAnAutoTrigger,
    },
    // Off today; the Produtor's switch-on would air them all the same.
    {
      name: 'refuses it when that auto trigger is off',
      trigger: buildBoxEnteredTrigger({ mode: 'auto', isEnabled: false }),
      command: {
        type: 'updateMacro' as const,
        macroId: interviewInTheBoxMacro.id,
        steps: newSteps,
      },
      refusal: refusedChangingTheMacroOfAnAutoTrigger,
    },
    // The button's text and colour put nothing on air.
    {
      name: 'allows renaming and repainting a macro an auto trigger runs',
      trigger: buildBoxEnteredTrigger({ mode: 'auto' }),
      command: {
        type: 'updateMacro' as const,
        macroId: interviewInTheBoxMacro.id,
        label: 'Entrevista',
        color: 'highlight' as const,
        steps: interviewInTheBoxMacro.steps,
      },
      refusal: undefined,
    },
  ];

  it.each(scenarios)('$name', ({ trigger, command, refusal }) => {
    // Arrange: the store holds the row's trigger, which runs the interview macro.
    const slices = buildSlicesHolding(trigger, buildFastestLapRule());

    // Act: ask the check about Dados's change of the macro.
    const answer = findWhyTheDataRoleMayNotChangeThisAutomation(command, slices);

    // Assert: the row's answer.
    expect(answer, 'the refusal sentence, or none when Dados may').toBe(refusal);
  });
});

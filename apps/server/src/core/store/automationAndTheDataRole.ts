import { isDeepStrictEqual } from 'node:util';

import {
  type Command,
  type CommandError,
  type EventRule,
  type Slices,
  type Trigger,
  type UpdateEventRuleCommand,
  type UpdateMacroCommand,
  type UpdateTriggerCommand,
  whyTheDataRoleCannotAutomate,
} from '@bajaovrlay/shared';

import { readRoleOfLoggedInOperatorActor } from './commandActors.js';

/** The slices the check reads: nothing else in the store can automate the air. */
type SlicesTheCheckReads = Pick<Slices, 'triggers' | 'eventRules' | 'macros'>;

/**
 * The store's second authorisation check, after the hook: Dados's command refused as
 * NOT_ALLOWED when it would automate the air (findWhyTheDataRoleMayNotChangeThisAutomation),
 * or undefined. Every other actor, the Produtor among them, is not judged here.
 */
export function refuseAutomationTheActorMayNotChange(
  command: Command,
  actor: string,
  slices: SlicesTheCheckReads,
): CommandError | undefined {
  if (readRoleOfLoggedInOperatorActor(actor) !== 'dados') {
    return undefined;
  }
  const reason = findWhyTheDataRoleMayNotChangeThisAutomation(command, slices);
  return reason === undefined ? undefined : { code: 'NOT_ALLOWED', message: reason };
}

/**
 * Answers why Dados may not send this command, when it would make the air change by itself
 * (gate 2 of PR #51), or undefined when it may. Dados may leave a trigger or a rule only in
 * "perguntar" or "ignorar"; an auto one it may still rename, re-time, switch off or set
 * back to asking, but not change what it runs or waits for; nor the steps of a macro an
 * auto trigger runs. Judged against the store's slices, since the page sends the whole
 * trigger or rule at every save: a field sent with its stored value is no change.
 */
export function findWhyTheDataRoleMayNotChangeThisAutomation(
  command: Command,
  slices: SlicesTheCheckReads,
): string | undefined {
  if (command.type === 'createTrigger') {
    return command.mode === 'auto' ? whyTheDataRoleCannotAutomate.settingATriggerToAuto : undefined;
  }
  if (command.type === 'updateTrigger') {
    return findWhyNotForATriggerUpdate(command, slices.triggers);
  }
  if (command.type === 'updateEventRule') {
    return findWhyNotForARuleUpdate(command, slices.eventRules);
  }
  if (command.type === 'updateMacro') {
    return findWhyNotForAMacroUpdate(command, slices);
  }
  return undefined;
}

/** A trigger update: judged on the trigger as it would be once the update is applied. */
function findWhyNotForATriggerUpdate(
  command: UpdateTriggerCommand,
  triggers: Trigger[],
): string | undefined {
  const storedTrigger = triggers.find((trigger) => trigger.id === command.triggerId);
  if (storedTrigger === undefined) {
    // The reducer refuses an unknown trigger by name; that refusal is the clearer one.
    return undefined;
  }
  const modeAfter = command.mode ?? storedTrigger.mode;
  const isEnabledAfter = command.isEnabled ?? storedTrigger.isEnabled;
  const whenAfter = command.when ?? storedTrigger.when;
  const macroIdAfter = command.macroId ?? storedTrigger.macroId;
  const isAutoAfter = modeAfter === 'auto';
  if (!isAutoAfter) {
    return undefined;
  }
  const wasAutoBefore = storedTrigger.mode === 'auto';
  if (!wasAutoBefore) {
    return whyTheDataRoleCannotAutomate.settingATriggerToAuto;
  }
  const isBeingSwitchedOn = isEnabledAfter && !storedTrigger.isEnabled;
  if (isBeingSwitchedOn) {
    return whyTheDataRoleCannotAutomate.switchingOnAnAutoTrigger;
  }
  const isMacroChanged = macroIdAfter !== storedTrigger.macroId;
  const isWhenChanged = !isDeepStrictEqual(whenAfter, storedTrigger.when);
  if (isMacroChanged || isWhenChanged) {
    return whyTheDataRoleCannotAutomate.changingAnAutoTrigger;
  }
  return undefined;
}

/** A rule update: judged on the rule as it would be once the update is applied. */
function findWhyNotForARuleUpdate(
  command: UpdateEventRuleCommand,
  eventRules: EventRule[],
): string | undefined {
  const storedRule = eventRules.find((rule) => rule.kind === command.kind);
  if (storedRule === undefined) {
    return undefined;
  }
  const modeAfter = command.mode ?? storedRule.mode;
  // null is a value here ("no item", "no maximum wait"); only undefined means "left out".
  const itemIdAfter = command.itemId === undefined ? storedRule.itemId : command.itemId;
  const durationMsAfter = command.durationMs ?? storedRule.durationMs;
  const maxAgeMsAfter = command.maxAgeMs === undefined ? storedRule.maxAgeMs : command.maxAgeMs;
  if (modeAfter !== 'auto') {
    return undefined;
  }
  if (storedRule.mode !== 'auto') {
    return whyTheDataRoleCannotAutomate.settingARuleToAuto;
  }
  const isWhatGoesOnAirChanged =
    itemIdAfter !== storedRule.itemId ||
    durationMsAfter !== storedRule.durationMs ||
    maxAgeMsAfter !== storedRule.maxAgeMs;
  return isWhatGoesOnAirChanged ? whyTheDataRoleCannotAutomate.changingAnAutoRule : undefined;
}

/**
 * A macro update: its steps are what an auto trigger airs, so they are the Produtor's as
 * long as any auto trigger, on or off, runs the macro. Its label and colour are not.
 */
function findWhyNotForAMacroUpdate(
  command: UpdateMacroCommand,
  slices: SlicesTheCheckReads,
): string | undefined {
  const storedMacro = slices.macros.find((macro) => macro.id === command.macroId);
  if (storedMacro === undefined || command.steps === undefined) {
    return undefined;
  }
  const isRunByAnAutoTrigger = slices.triggers.some(
    (trigger) => trigger.mode === 'auto' && trigger.macroId === command.macroId,
  );
  const areTheStepsChanged = !isDeepStrictEqual(command.steps, storedMacro.steps);
  if (isRunByAnAutoTrigger && areTheStepsChanged) {
    return whyTheDataRoleCannotAutomate.changingTheMacroOfAnAutoTrigger;
  }
  return undefined;
}

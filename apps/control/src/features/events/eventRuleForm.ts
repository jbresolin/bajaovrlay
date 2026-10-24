/**
 * One row of "Regras" as text, and the updateEventRule it becomes. Pure, so each rule is
 * tested without a page; the server checks the command again (its schema refuses a Super
 * Chat on auto and a typed event on ignore whatever the page sends).
 */
import {
  type EventRule,
  type EventRuleMode,
  eventRuleTimeLimitsMs,
  type InboxEventKind,
  type UpdateEventRuleCommand,
} from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

const problems = ptBR.events.rules.problems;
const millisecondsPerSecond = 1_000;

/** The dropdown's value for "no item": a Select cannot hold the empty text. */
export const noItemChoice = 'nenhum';

/** What a row holds while the operator edits it: the times as the text in their inputs. */
export type EventRuleFormValues = {
  mode: EventRuleMode;
  /** An item's id, or noItemChoice. */
  itemChoice: string;
  durationSecondsText: string;
  /** Empty: no maximum wait. */
  maxAgeSecondsText: string;
};

/** The row of a rule as the server holds it. */
export function buildEventRuleFormValues(rule: EventRule): EventRuleFormValues {
  return {
    mode: rule.mode,
    itemChoice: rule.itemId ?? noItemChoice,
    durationSecondsText: String(rule.durationMs / millisecondsPerSecond),
    maxAgeSecondsText: rule.maxAgeMs === null ? '' : String(rule.maxAgeMs / millisecondsPerSecond),
  };
}

/**
 * The modes a kind may have: a Super Chat only asks (a viewer's content is never shown
 * without approval), a typed event is never ignored, every other kind has all three.
 */
export function listModesOfferedForKind(kind: InboxEventKind): EventRuleMode[] {
  if (kind === 'superChat') {
    return ['ask'];
  }
  if (kind === 'manual') {
    return ['ask', 'auto'];
  }
  return ['ask', 'auto', 'ignore'];
}

/** What reading a row gives: the command to send, or the first problem in pt-BR. */
export type EventRuleFormReading =
  { status: 'ready'; command: UpdateEventRuleCommand } | { status: 'problem'; message: string };

/** Whole seconds within the rule's limits, as ms; undefined when the text is not that. */
function readSecondsWithinLimitsAsMs(secondsText: string): number | undefined {
  const trimmedText = secondsText.trim();
  if (!/^\d+$/.test(trimmedText)) {
    return undefined;
  }
  const milliseconds = Number(trimmedText) * millisecondsPerSecond;
  const isWithinLimits =
    milliseconds >= eventRuleTimeLimitsMs.shortest && milliseconds <= eventRuleTimeLimitsMs.longest;
  return isWithinLimits ? milliseconds : undefined;
}

/**
 * Reads a row into updateEventRule, the whole rule: the mode, the item (null for none),
 * the seconds on air (1 to 3600, required) and the maximum wait (the same, or blank for
 * none), both sent in ms.
 */
export function readEventRuleFormIntoCommand(
  kind: InboxEventKind,
  values: EventRuleFormValues,
): EventRuleFormReading {
  const durationMs = readSecondsWithinLimitsAsMs(values.durationSecondsText);
  if (durationMs === undefined) {
    return { status: 'problem', message: problems.duration };
  }
  const isMaxAgeBlank = values.maxAgeSecondsText.trim() === '';
  const maxAgeMs = isMaxAgeBlank ? null : readSecondsWithinLimitsAsMs(values.maxAgeSecondsText);
  if (maxAgeMs === undefined) {
    return { status: 'problem', message: problems.maxAge };
  }
  return {
    status: 'ready',
    command: {
      type: 'updateEventRule',
      kind,
      mode: values.mode,
      itemId: values.itemChoice === noItemChoice ? null : values.itemChoice,
      durationMs,
      maxAgeMs,
    },
  };
}

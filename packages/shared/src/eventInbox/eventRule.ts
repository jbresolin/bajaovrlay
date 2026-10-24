import { z } from 'zod';

import { InboxEventKindSchema } from './inboxEvent.js';
import { ptBREventInbox } from './ptBREventInbox.js';

/**
 * What happens to an event of a kind: `ask` waits for the operator, `auto` goes on air by
 * itself (the runner, queued while its layer is busy), `ignore` is not even listed.
 */
export const EventRuleModeSchema = z.enum(['ask', 'auto', 'ignore']);

/** One mode of an event rule. */
export type EventRuleMode = z.infer<typeof EventRuleModeSchema>;

/** The longest an event can stay on air or wait: one hour, longer is surely a typo. */
const longestEventTimeMs = 60 * 60_000;

/**
 * Refuses the two modes a kind may never have: a viewer's Super Chat is never shown
 * without approval (João's rule), and a manual event, typed by the operator, is never
 * ignored (it would vanish as it is typed). Reported at the mode.
 */
export function checkModeAllowedForKind(
  rule: { kind: z.infer<typeof InboxEventKindSchema>; mode?: EventRuleMode | undefined },
  context: z.RefinementCtx,
): void {
  if (rule.kind === 'superChat' && rule.mode === 'auto') {
    context.addIssue({
      code: 'custom',
      path: ['mode'],
      message: ptBREventInbox.ruleReasons.superChatNeverAuto,
    });
  }
  if (rule.kind === 'manual' && rule.mode === 'ignore') {
    context.addIssue({
      code: 'custom',
      path: ['mode'],
      message: ptBREventInbox.ruleReasons.manualNeverIgnored,
    });
  }
}

/**
 * The rule of one kind of event: its mode, the prepared item that shows it (null: none
 * chosen yet, nothing can go on air), how long that item stays on air, and how long an
 * event may wait before it expires (null: it waits until the operator decides).
 */
export const EventRuleSchema = z
  .object({
    kind: InboxEventKindSchema,
    mode: EventRuleModeSchema,
    itemId: z.string().min(1).nullable(),
    durationMs: z.number().int().min(1000).max(longestEventTimeMs),
    maxAgeMs: z.number().int().min(1000).max(longestEventTimeMs).nullable(),
  })
  .superRefine((rule, context) => checkModeAllowedForKind(rule, context));

/** One event rule after validation. */
export type EventRule = z.infer<typeof EventRuleSchema>;

/** The `eventRules` slice: one rule per kind, saved; screens never receive it. */
export const EventRulesSchema = z.array(EventRuleSchema);

/** The limits of a rule's times, for the commands that change them. */
export const eventRuleTimeLimitsMs = { shortest: 1000, longest: longestEventTimeMs };

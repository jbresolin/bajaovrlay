/**
 * The rule of one kind of event (packages/shared)
 *
 * What this module is for:
 *   EventRuleSchema is what the `eventRules` slice holds per kind: ask the operator, go on
 *   air by itself, or ignore, with the item that shows the event, its duration on air and
 *   how long it may wait. Two modes are refused by the schema itself, so no path can
 *   store them: a viewer's Super Chat on air by itself (João's rule: never without
 *   approval), and a manual event ignored (it would vanish as it is typed). The
 *   updateEventRule command's schema runs the same check.
 *
 * What these tests prove:
 *   - A fastest lap rule on air by itself for 8 s is accepted.
 *   - A Super Chat rule set to auto is refused at its mode, with the pt-BR reason; set to
 *     ask it is accepted.
 *   - A manual rule set to ignore is refused at its mode.
 *   - The command schema refuses a Super Chat set to auto too, and accepts a change that
 *     carries no mode at all.
 *   - A duration under a second is refused.
 *
 * What these tests deliberately do not cover:
 *   - The seeded defaults and their storage; the server's eventRulesOnTheStore.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { UpdateEventRuleCommandSchema } from './eventCommands.js';
import { EventRuleSchema } from './eventRule.js';

describe('EventRuleSchema', () => {
  const ruleScenarios = [
    // João's default for fastest laps: on air by itself for 8 s, stale after 2 minutes.
    {
      name: 'accepts a fastest lap rule on air by itself',
      rule: {
        kind: 'fastestLap',
        mode: 'auto',
        itemId: 'volta-mais-rapida',
        durationMs: 8_000,
        maxAgeMs: 120_000,
      },
      expectedIssue: undefined,
    },
    // The one thing the schema exists to refuse: a viewer's message on air unapproved.
    {
      name: 'refuses a Super Chat rule on air by itself',
      rule: { kind: 'superChat', mode: 'auto', itemId: null, durationMs: 15_000, maxAgeMs: null },
      expectedIssue: {
        path: ['mode'],
        message:
          'Super Chat nunca entra no ar sozinho: o conteúdo de um espectador sempre espera aprovação.',
      },
    },
    // Waiting for approval is the only way a Super Chat goes on air.
    {
      name: 'accepts a Super Chat rule that asks',
      rule: { kind: 'superChat', mode: 'ask', itemId: null, durationMs: 15_000, maxAgeMs: null },
      expectedIssue: undefined,
    },
    // An event the operator types must reach the inbox.
    {
      name: 'refuses a manual rule that ignores',
      rule: { kind: 'manual', mode: 'ignore', itemId: null, durationMs: 10_000, maxAgeMs: null },
      expectedIssue: {
        path: ['mode'],
        message: 'Um evento digitado pelo operador não pode ser ignorado.',
      },
    },
    // A notice that leaves before it is read is a typo; one second is the least.
    {
      name: 'refuses a duration under a second',
      rule: { kind: 'newIncident', mode: 'ask', itemId: null, durationMs: 500, maxAgeMs: null },
      expectedIssue: { path: ['durationMs'] },
    },
  ];

  it.each(ruleScenarios)('$name', ({ rule, expectedIssue }) => {
    // Arrange: this row's rule.

    // Act: check it.
    const result = EventRuleSchema.safeParse(rule);

    // Assert: accepted, or refused at this row's field (with its message when it has one).
    if (expectedIssue === undefined) {
      expect(result.success, 'the rule must be accepted').toBe(true);
      return;
    }
    const firstIssue = result.error?.issues[0];
    expect(firstIssue?.path, 'the rule must be refused at this field').toEqual(expectedIssue.path);
    if ('message' in expectedIssue) {
      expect(firstIssue?.message, 'the refusal must say why in pt-BR').toBe(expectedIssue.message);
    }
  });
});

describe('UpdateEventRuleCommandSchema', () => {
  it('refuses to set a Super Chat rule to auto', () => {
    // Arrange: the change "Regras" would send if it offered auto for Super Chat.
    const command = { type: 'updateEventRule', kind: 'superChat', mode: 'auto' };

    // Act: check it.
    const result = UpdateEventRuleCommandSchema.safeParse(command);

    // Assert: refused at the mode.
    expect(result.error?.issues[0]?.path, 'the mode must be refused').toEqual(['mode']);
  });

  it('accepts a change of a Super Chat rule that carries no mode', () => {
    // Arrange: a new duration for Super Chats, the mode left as it is.
    const command = { type: 'updateEventRule', kind: 'superChat', durationMs: 20_000 };

    // Act: check it.
    const result = UpdateEventRuleCommandSchema.safeParse(command);

    // Assert: accepted; only a mode of auto is refused.
    expect(result.success, 'a change without a mode must be accepted').toBe(true);
  });
});

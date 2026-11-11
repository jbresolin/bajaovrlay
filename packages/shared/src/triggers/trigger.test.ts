/**
 * A trigger and its commands (packages/shared)
 *
 * What this module is for:
 *   A trigger (BAJAOVRLAY-48) is a rule: when something outside the operator's hands
 *   happens (an OBS scene entered or left, an HTTP call, an inbox event, a time in the
 *   schedule), a macro runs, at once ("auto") or after the operator says yes ("ask").
 *   TriggerSchema is what the `triggers` slice holds; createTrigger fills in the defaults
 *   the brief asks for.
 *
 * What these tests prove:
 *   - Each of the four kinds is accepted with its filter, as the page writes it; a schedule
 *     every N minutes (BAJAOVRLAY-64) all day or between two times of the day, and the
 *     moment the server counts it from.
 *   - createTrigger defaults to on, "ask" and a minimum interval of 10 s.
 *   - A time of day that is not HH:MM on a 24-hour clock, an offset past twelve hours
 *     from a slot, an interval under one second, and every N minutes under 5 or over 240
 *     are refused.
 *
 * What these tests deliberately do not cover:
 *   - Whether the macro named exists; the server's reducers refuse an unknown one.
 *   - When a trigger fires; apps/server's modules/triggers tests.
 */
import { describe, expect, it } from 'vitest';

import { TriggerSchema } from './trigger.js';
import { CreateTriggerCommandSchema } from './triggerCommands.js';

/** A trigger as the server stores one: "Box" entered runs "Entrevista no box". */
function buildBoxSceneTrigger() {
  return {
    id: 'gatilho-box',
    name: 'Entrou no box',
    isEnabled: true,
    when: { kind: 'obsScene', change: 'entered', sceneName: 'Box' },
    macroId: 'entrevista-no-box',
    mode: 'auto',
    minimumIntervalMs: 10_000,
  };
}

describe('TriggerSchema', () => {
  const acceptedFilters = [
    // The brief's first example: a scene entered.
    {
      name: 'accepts an OBS scene entered',
      when: { kind: 'obsScene', change: 'entered', sceneName: 'Box' },
    },
    // An HTTP trigger has no filter: its address is its own id.
    { name: 'accepts an HTTP trigger', when: { kind: 'http' } },
    // A penalty recorded in the inbox.
    { name: 'accepts a penalty event', when: { kind: 'dataEvent', eventKind: 'penalty' } },
    // A fixed time on the server's clock.
    {
      name: 'accepts a time of day',
      when: { kind: 'schedule', moment: { kind: 'timeOfDay', timeOfDay: '19:30' } },
    },
    // Ten minutes before one named slot of Programação.
    {
      name: 'accepts ten minutes before a slot',
      when: {
        kind: 'schedule',
        moment: { kind: 'slotStart', slotId: 'enduro-sabado', minutesFromStart: -10 },
      },
    },
    // A null slot means every slot of the day.
    {
      name: 'accepts five minutes after every slot',
      when: { kind: 'schedule', moment: { kind: 'slotStart', slotId: null, minutesFromStart: 5 } },
    },
    // The plain sponsor roll's: every 30 minutes, all day (BAJAOVRLAY-64).
    {
      name: 'accepts every 30 minutes all day',
      when: {
        kind: 'schedule',
        moment: { kind: 'everyMinutes', everyMinutes: 30, window: null },
      },
    },
    // Only while the cars are on track: from 08:00 to 18:00.
    {
      name: 'accepts every 30 minutes between 08:00 and 18:00',
      when: {
        kind: 'schedule',
        moment: { kind: 'everyMinutes', everyMinutes: 30, window: { from: '08:00', to: '18:00' } },
      },
    },
    // A window across midnight, for a night enduro.
    {
      name: 'accepts a window that crosses midnight',
      when: {
        kind: 'schedule',
        moment: { kind: 'everyMinutes', everyMinutes: 240, window: { from: '22:00', to: '02:00' } },
      },
    },
  ];

  it.each(acceptedFilters)('$name', ({ when }) => {
    // Arrange: the Box trigger with this row's kind and filter.
    const trigger = { ...buildBoxSceneTrigger(), when };

    // Act: check it.
    const result = TriggerSchema.safeParse(trigger);

    // Assert: accepted.
    expect(result.success, 'each kind with its filter must be a valid trigger').toBe(true);
  });

  const refusedTriggers = [
    // 25:00 is a typo, not tomorrow at one.
    {
      name: 'refuses a time of day past 23:59',
      change: { when: { kind: 'schedule', moment: { kind: 'timeOfDay', timeOfDay: '25:00' } } },
    },
    // "7:30" is ambiguous on a page that always writes two digits.
    {
      name: 'refuses a time of day without two digits for the hour',
      change: { when: { kind: 'schedule', moment: { kind: 'timeOfDay', timeOfDay: '7:30' } } },
    },
    // Thirteen hours before a slot is another day; surely a typo.
    {
      name: 'refuses an offset past twelve hours',
      change: {
        when: {
          kind: 'schedule',
          moment: { kind: 'slotStart', slotId: null, minutesFromStart: -780 },
        },
      },
    },
    // Under a second, a flickering scene would fire a macro per flicker.
    { name: 'refuses an interval under one second', change: { minimumIntervalMs: 500 } },
    // Every 4 minutes would have the roll on air most of the time: the brief's floor is 5.
    {
      name: 'refuses every N minutes under 5',
      change: {
        when: { kind: 'schedule', moment: { kind: 'everyMinutes', everyMinutes: 4, window: null } },
      },
    },
    // Past four hours, a time of day says it better.
    {
      name: 'refuses every N minutes over 240',
      change: {
        when: {
          kind: 'schedule',
          moment: { kind: 'everyMinutes', everyMinutes: 241, window: null },
        },
      },
    },
    // A window needs two times of the day, each HH:MM.
    {
      name: 'refuses a window whose end is not a time of day',
      change: {
        when: {
          kind: 'schedule',
          moment: { kind: 'everyMinutes', everyMinutes: 30, window: { from: '08:00', to: '18h' } },
        },
      },
    },
  ];

  it.each(refusedTriggers)('$name', ({ change }) => {
    // Arrange: the Box trigger with this row's mistake.
    const trigger = { ...buildBoxSceneTrigger(), ...change };

    // Act: check it.
    const result = TriggerSchema.safeParse(trigger);

    // Assert: refused.
    expect(result.success, 'a trigger with this mistake must be refused').toBe(false);
  });
});

describe('the moment an interval is counted from', () => {
  it('keeps the moment the server stamped when the trigger was switched on', () => {
    // Arrange: the seeded sponsor trigger, switched on at 08:00 in Brasília on race day.
    const trigger = {
      ...buildBoxSceneTrigger(),
      name: 'Patrocinadores a cada 30 min',
      when: { kind: 'schedule', moment: { kind: 'everyMinutes', everyMinutes: 30, window: null } },
      intervalCountedFromMs: Date.parse('2026-11-14T11:00:00.000Z'),
    };

    // Act: check it.
    const result = TriggerSchema.safeParse(trigger);

    // Assert: accepted with the moment, which the next firings count from.
    expect(result.data?.intervalCountedFromMs, 'the switch-on moment must be kept').toBe(
      Date.parse('2026-11-14T11:00:00.000Z'),
    );
  });
});

describe('CreateTriggerCommandSchema', () => {
  it('defaults to on, asking the operator, with ten seconds between firings', () => {
    // Arrange: the least a page may send: a name, a kind and a macro.
    const command = {
      type: 'createTrigger',
      name: 'Saiu da pista',
      when: { kind: 'obsScene', change: 'left', sceneName: 'Pista' },
      macroId: 'replay-da-pista',
    };

    // Act: check it, filling the defaults.
    const parsed = CreateTriggerCommandSchema.parse(command);

    // Assert: on, ask (never on air by surprise), and the brief's 10 s.
    expect(
      {
        isEnabled: parsed.isEnabled,
        mode: parsed.mode,
        minimumIntervalMs: parsed.minimumIntervalMs,
      },
      'a new trigger must be on, ask first, and wait 10 s between firings',
    ).toEqual({ isEnabled: true, mode: 'ask', minimumIntervalMs: 10_000 });
  });
});

/**
 * The trigger editor's values and the command they become (apps/control)
 *
 * What this module is for:
 *   The editor of "Gatilhos" (BAJAOVRLAY-48) holds a trigger as the text in its controls:
 *   the kind with its filter, the macro, the mode, the minimum interval in seconds and
 *   on/off. triggerForm.ts reads those values into createTrigger (a new trigger) or
 *   updateTrigger (the whole trigger, as "Regras" sends a whole rule), or into the first
 *   problem in pt-BR, so nothing wrong is ever sent. Pure, so every rule reads as a table.
 *
 * What these tests prove:
 *   - Each kind becomes its `when`: a scene entered or left, an HTTP call, a penalty, a
 *     time of day, ten minutes before one slot, five minutes after every slot, every 30
 *     minutes all day and every 30 minutes from 08:00 to 18:00 (BAJAOVRLAY-64).
 *   - The seconds become ms; a stored trigger reads back into the same values, the
 *     seeded "Patrocinadores a cada 30 min" too.
 *   - A missing name, scene, time, macro, a bad offset, every N minutes outside 5 to 240,
 *     a window with a bad time and an interval outside 1 to 3600 s are refused with their
 *     pt-BR reason.
 *
 * What these tests deliberately do not cover:
 *   - The dialog that draws the values; TriggersDialog.test.tsx.
 *   - What the server does with the command; apps/server's modules/triggers tests.
 */
import type { Trigger } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildEmptyTriggerFormValues,
  buildTriggerFormValues,
  everySlotChoice,
  readTriggerFormIntoCommand,
  type TriggerFormValues,
} from './triggerForm';

/** "Entrou no box" as the operator fills it in: Box entered runs the interview, by itself. */
function buildBoxEnteredValues(): TriggerFormValues {
  return {
    ...buildEmptyTriggerFormValues(),
    name: 'Entrou no box',
    kind: 'obsScene',
    sceneChange: 'entered',
    sceneName: 'Box',
    macroId: 'macro-entrevista-no-box',
    mode: 'auto',
  };
}

describe('readTriggerFormIntoCommand, a new trigger', () => {
  const kindsAndTheirWhen = [
    // The brief's first example.
    {
      name: 'a scene entered',
      change: {},
      expectedWhen: { kind: 'obsScene', change: 'entered', sceneName: 'Box' },
    },
    // Leaving a scene is the same kind, the other change.
    {
      name: 'a scene left',
      change: { sceneChange: 'left', sceneName: 'Pista' },
      expectedWhen: { kind: 'obsScene', change: 'left', sceneName: 'Pista' },
    },
    // An HTTP trigger has no filter; the scene typed before is not sent.
    { name: 'an HTTP call', change: { kind: 'http' }, expectedWhen: { kind: 'http' } },
    // A penalty recorded in the inbox.
    {
      name: 'a penalty',
      change: { kind: 'dataEvent', dataEventKind: 'penalty' },
      expectedWhen: { kind: 'dataEvent', eventKind: 'penalty' },
    },
    // A fixed time on the server's clock.
    {
      name: 'a time of day',
      change: { kind: 'schedule', scheduleMomentKind: 'timeOfDay', timeOfDay: '19:30' },
      expectedWhen: { kind: 'schedule', moment: { kind: 'timeOfDay', timeOfDay: '19:30' } },
    },
    // "10 minutos antes" of one slot: a negative offset.
    {
      name: 'ten minutes before one slot',
      change: {
        kind: 'schedule',
        scheduleMomentKind: 'slotStart',
        slotChoice: 'enduro-sabado',
        minutesText: '10',
        slotDirection: 'before',
      },
      expectedWhen: {
        kind: 'schedule',
        moment: { kind: 'slotStart', slotId: 'enduro-sabado', minutesFromStart: -10 },
      },
    },
    // "5 minutos depois" of every slot: a null slot.
    {
      name: 'five minutes after every slot',
      change: {
        kind: 'schedule',
        scheduleMomentKind: 'slotStart',
        slotChoice: everySlotChoice,
        minutesText: '5',
        slotDirection: 'after',
      },
      expectedWhen: {
        kind: 'schedule',
        moment: { kind: 'slotStart', slotId: null, minutesFromStart: 5 },
      },
    },
    // The plain sponsor roll's: every 30 minutes all day; the window's times typed before
    // are not sent while "Só entre dois horários" is off.
    {
      name: 'every 30 minutes all day',
      change: {
        kind: 'schedule',
        scheduleMomentKind: 'everyMinutes',
        everyMinutesText: '30',
        isDayWindowOn: false,
        windowFromText: '08:00',
        windowToText: '18:00',
      },
      expectedWhen: {
        kind: 'schedule',
        moment: { kind: 'everyMinutes', everyMinutes: 30, window: null },
      },
    },
    // Only while the cars are on track.
    {
      name: 'every 30 minutes from 08:00 to 18:00',
      change: {
        kind: 'schedule',
        scheduleMomentKind: 'everyMinutes',
        everyMinutesText: '30',
        isDayWindowOn: true,
        windowFromText: '08:00',
        windowToText: '18:00',
      },
      expectedWhen: {
        kind: 'schedule',
        moment: { kind: 'everyMinutes', everyMinutes: 30, window: { from: '08:00', to: '18:00' } },
      },
    },
  ];

  it.each(kindsAndTheirWhen)('builds $name', ({ change, expectedWhen }) => {
    // Arrange: the Box trigger with this row's kind and filter.
    const values = { ...buildBoxEnteredValues(), ...change } as TriggerFormValues;

    // Act: read it as a new trigger.
    const reading = readTriggerFormIntoCommand(values, null);

    // Assert: createTrigger with that `when`, the interval in ms.
    expect(reading, 'the kind and its filter must become the trigger’s when').toEqual({
      status: 'ready',
      command: {
        type: 'createTrigger',
        name: 'Entrou no box',
        isEnabled: true,
        when: expectedWhen,
        macroId: 'macro-entrevista-no-box',
        mode: 'auto',
        minimumIntervalMs: 10_000,
      },
    });
  });

  const valuesWithAProblem = [
    // A trigger with no name cannot be found again in the list.
    {
      name: 'refuses a blank name',
      change: { name: '  ' },
      expected: 'Informe o nome do gatilho.',
    },
    // A scene trigger must say which scene.
    {
      name: 'refuses a scene trigger with no scene',
      change: { sceneName: '' },
      expected: 'Informe a cena do OBS.',
    },
    // "7h30" is how people write it, not how the server reads it.
    {
      name: 'refuses a time of day that is not HH:MM',
      change: { kind: 'schedule', scheduleMomentKind: 'timeOfDay', timeOfDay: '7h30' },
      expected: 'Informe o horário como HH:MM, de 00:00 a 23:59 (por exemplo 07:30).',
    },
    // More than twelve hours from a slot is another day.
    {
      name: 'refuses an offset past 720 minutes',
      change: { kind: 'schedule', scheduleMomentKind: 'slotStart', minutesText: '800' },
      expected: 'Informe os minutos como um número inteiro de 0 a 720.',
    },
    // Every 4 minutes would have the roll on air most of the time.
    {
      name: 'refuses every N minutes under 5',
      change: { kind: 'schedule', scheduleMomentKind: 'everyMinutes', everyMinutesText: '4' },
      expected: 'Informe a cada quantos minutos como um número inteiro de 5 a 240.',
    },
    // "meia hora" is how people say it, not a number.
    {
      name: 'refuses every N minutes that is not a number',
      change: {
        kind: 'schedule',
        scheduleMomentKind: 'everyMinutes',
        everyMinutesText: 'meia hora',
      },
      expected: 'Informe a cada quantos minutos como um número inteiro de 5 a 240.',
    },
    // A window needs both ends as HH:MM.
    {
      name: 'refuses a window whose end is not HH:MM',
      change: {
        kind: 'schedule',
        scheduleMomentKind: 'everyMinutes',
        everyMinutesText: '30',
        isDayWindowOn: true,
        windowFromText: '08:00',
        windowToText: '18h',
      },
      expected:
        'Informe o começo e o fim como HH:MM, de 00:00 a 23:59 (por exemplo 08:00 e 18:00).',
    },
    // Every trigger runs a macro.
    { name: 'refuses no macro', change: { macroId: '' }, expected: 'Escolha a macro do gatilho.' },
    // Under a second, a flickering scene would fire a macro per flicker.
    {
      name: 'refuses an interval of zero seconds',
      change: { minimumIntervalSecondsText: '0' },
      expected: 'Informe o intervalo mínimo em segundos, de 1 a 3600.',
    },
  ];

  it.each(valuesWithAProblem)('$name', ({ change, expected }) => {
    // Arrange: the Box trigger with this row's mistake.
    const values = { ...buildBoxEnteredValues(), ...change } as TriggerFormValues;

    // Act: read it.
    const reading = readTriggerFormIntoCommand(values, null);

    // Assert: the problem, nothing to send.
    expect(reading, 'a wrong value must be refused on the page').toEqual({
      status: 'problem',
      message: expected,
    });
  });
});

describe('a stored trigger', () => {
  it('reads back into the editor and saves as the whole trigger', () => {
    // Arrange: "Contagem do Enduro", ten minutes before the Enduro, off, 30 s apart.
    const storedTrigger: Trigger = {
      id: 'gatilho-contagem',
      name: 'Contagem do Enduro',
      isEnabled: false,
      when: {
        kind: 'schedule',
        moment: { kind: 'slotStart', slotId: 'enduro-sabado', minutesFromStart: -10 },
      },
      macroId: 'macro-contagem',
      mode: 'ask',
      minimumIntervalMs: 30_000,
    };

    // Act: open it in the editor and save it unchanged.
    const values = buildTriggerFormValues(storedTrigger);
    const reading = readTriggerFormIntoCommand(values, storedTrigger.id);

    // Assert: the editor's text, and an updateTrigger carrying the same trigger.
    expect(
      {
        minutesText: values.minutesText,
        slotDirection: values.slotDirection,
        minimumIntervalSecondsText: values.minimumIntervalSecondsText,
      },
      'the offset shows as minutes before, the interval in seconds',
    ).toEqual({ minutesText: '10', slotDirection: 'before', minimumIntervalSecondsText: '30' });
    expect(reading, 'saving sends the whole trigger').toEqual({
      status: 'ready',
      command: {
        type: 'updateTrigger',
        triggerId: 'gatilho-contagem',
        name: 'Contagem do Enduro',
        isEnabled: false,
        when: storedTrigger.when,
        macroId: 'macro-contagem',
        mode: 'ask',
        minimumIntervalMs: 30_000,
      },
    });
  });
});

describe('the seeded "Patrocinadores a cada 30 min"', () => {
  it('reads back as every 30 minutes all day, off and asking, and saves unchanged', () => {
    // Arrange: the trigger as the server seeds it, never switched on.
    const seededTrigger: Trigger = {
      id: 'patrocinadores-a-cada-30-min',
      name: 'Patrocinadores a cada 30 min',
      isEnabled: false,
      when: { kind: 'schedule', moment: { kind: 'everyMinutes', everyMinutes: 30, window: null } },
      macroId: 'patrocinadores-simples',
      mode: 'ask',
      minimumIntervalMs: 10_000,
    };

    // Act: open it in the editor and save it unchanged.
    const values = buildTriggerFormValues(seededTrigger);
    const reading = readTriggerFormIntoCommand(values, seededTrigger.id);

    // Assert: "A cada 30 minutos", no window, and the same trigger sent back.
    expect(
      {
        scheduleMomentKind: values.scheduleMomentKind,
        everyMinutesText: values.everyMinutesText,
        isDayWindowOn: values.isDayWindowOn,
      },
      'the editor shows every 30 minutes, all day',
    ).toEqual({ scheduleMomentKind: 'everyMinutes', everyMinutesText: '30', isDayWindowOn: false });
    expect(
      reading.status === 'ready' && reading.command.when,
      'saving sends the same when',
    ).toEqual(seededTrigger.when);
  });
});

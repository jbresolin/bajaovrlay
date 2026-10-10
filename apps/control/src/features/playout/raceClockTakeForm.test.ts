/**
 * Race clock take form: rules and payload (apps/control)
 *
 * What this module is for:
 *   Before the race clock goes on air the operator fills a small form: session name,
 *   flag, clock mode, whether the clock is running, the time it should show (typed as
 *   mm:ss) and, optionally, the leader's laps. raceClockTakeForm holds everything about
 *   that form that is not drawing: its starting values, the rule for each field with its
 *   pt-BR message, the mm:ss conversion, and the `takeGraphic` command built from it.
 *
 * What these tests prove:
 *   - A correctly filled form becomes exactly the `takeGraphic` command the server and
 *     the race clock expect, on the `clock` layer, with the time in milliseconds and the
 *     moment of the take as the clock's reference.
 *   - Leaving the laps blank leaves the field out of the command, so the graphic hides it.
 *   - mm:ss text converts to milliseconds; text in any other shape is refused.
 *   - Each required field, when missing, gets the pt-BR message for that field; a wrong
 *     time or laps value gets its own message.
 *   - The form's starting values are valid and match the defaults in the manifest.
 *
 * What these tests deliberately do not cover:
 *   - Drawing the form and showing the messages; TakeRaceClockPanel.test.tsx does.
 *   - That these rules still match packages/graphics/race-clock/race-clock.ograf.json:
 *     they are a hand-written mirror, replaced by a generated form in BAJAOVRLAY-14.
 */
import { describe, expect, it } from 'vitest';

import {
  buildTakeRaceClockCommand,
  convertMinutesAndSecondsToMilliseconds,
  defaultRaceClockTakeFormValues,
  findRaceClockTakeFormErrors,
  type RaceClockTakeFormValues,
} from './raceClockTakeForm';

// 10:00 in Brasília on the Saturday of the endurance race, as Date.now() would give it.
const momentOfTheTakeInMilliseconds = Date.parse('2026-10-10T13:00:00.000Z');

/** The form as an operator fills it 12 min 34 s into the endurance race, under green. */
function buildFormFilledForTheEnduranceRace(): RaceClockTakeFormValues {
  return {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'elapsed',
    running: true,
    referenceTime: '12:34',
    lapsCompletedByLeader: '7',
  };
}

describe('buildTakeRaceClockCommand', () => {
  it('turns a filled form into the exact takeGraphic command for the clock layer', () => {
    // Arrange: the form filled for the endurance race.
    const formValues = buildFormFilledForTheEnduranceRace();

    // Act: build the command at the moment of the take.
    const command = buildTakeRaceClockCommand(formValues, momentOfTheTakeInMilliseconds);

    // Assert: the whole command, field by field (12:34 is 754 000 ms).
    expect(command, 'the command must be exactly what the race clock expects').toEqual({
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: {
        sessionName: 'Enduro de Resistência',
        state: 'green',
        clockMode: 'elapsed',
        referenceTimeMs: 754_000,
        referenceWallClockMs: momentOfTheTakeInMilliseconds,
        running: true,
        lapsCompletedByLeader: 7,
      },
    });
  });

  it('leaves the laps out of the command when the operator left them blank', () => {
    // Arrange: the same form before the first lap is complete, with the laps left blank.
    const formValues = { ...buildFormFilledForTheEnduranceRace(), lapsCompletedByLeader: '' };

    // Act: build the command.
    const command = buildTakeRaceClockCommand(formValues, momentOfTheTakeInMilliseconds);

    // Assert: the data has no laps field at all (the graphic refuses unknown or null fields).
    expect(command.data, 'a blank laps field must not appear in the data').not.toHaveProperty(
      'lapsCompletedByLeader',
    );
  });

  it('removes stray spaces around the session name', () => {
    // Arrange: a session name pasted with spaces around it.
    const formValues = { ...buildFormFilledForTheEnduranceRace(), sessionName: '  Enduro  ' };

    // Act: build the command.
    const command = buildTakeRaceClockCommand(formValues, momentOfTheTakeInMilliseconds);

    // Assert: the name goes on air without the stray spaces.
    expect(command.data.sessionName, 'the session name must be trimmed').toBe('Enduro');
  });
});

describe('convertMinutesAndSecondsToMilliseconds', () => {
  const timesTheFormAccepts = [
    // The start of a session: the clock at zero.
    { name: 'reads 0:00 as zero', text: '0:00', milliseconds: 0 },
    // Minutes and seconds both count: 65 seconds.
    { name: 'reads 1:05 as 65 seconds', text: '1:05', milliseconds: 65_000 },
    // A leading zero on the minutes is how many people type it.
    { name: 'reads 05:07 the same as 5:07', text: '05:07', milliseconds: 307_000 },
    // The last second before one hour.
    { name: 'reads 59:59 as one second short of an hour', text: '59:59', milliseconds: 3_599_000 },
    // The endurance race lasts four hours, so minutes may go past 59.
    { name: 'reads 240:00 as four hours', text: '240:00', milliseconds: 14_400_000 },
    // Spaces around the text come from copy and paste and mean nothing.
    { name: 'ignores spaces around the text', text: ' 12:34 ', milliseconds: 754_000 },
  ];

  it.each(timesTheFormAccepts)('$name', ({ text, milliseconds }) => {
    // Arrange: the text as typed in the "tempo de referência" field (see the scenario).

    // Act: convert it.
    const convertedTime = convertMinutesAndSecondsToMilliseconds(text);

    // Assert: the result is the same time in milliseconds.
    expect(convertedTime, `"${text}" must be ${milliseconds} milliseconds`).toBe(milliseconds);
  });

  const textsTheFormRefuses = [
    // Hours are not part of mm:ss; one hour is typed as 60:00.
    { name: 'refuses 1:00:00, which has an hours part', text: '1:00:00' },
    // There is no 60th second; it is the next minute.
    { name: 'refuses 1:60, because seconds stop at 59', text: '1:60' },
    // Seconds always take two digits, so 1:5 is ambiguous (five or fifty?).
    { name: 'refuses 1:5, because seconds need two digits', text: '1:5' },
    // A bare number does not say whether it means minutes or seconds.
    { name: 'refuses 90, which has no colon', text: '90' },
    // Words are not a time.
    { name: 'refuses "doze e trinta"', text: 'doze e trinta' },
    // A clock never shows negative time.
    { name: 'refuses -1:00', text: '-1:00' },
    // Nothing typed at all.
    { name: 'refuses an empty text', text: '' },
  ];

  it.each(textsTheFormRefuses)('$name', ({ text }) => {
    // Arrange: the text as typed in the "tempo de referência" field (see the scenario).

    // Act: try to convert it.
    const convertedTime = convertMinutesAndSecondsToMilliseconds(text);

    // Assert: there is no result, which is how the form knows to show a message.
    expect(convertedTime, `"${text}" is not a valid mm:ss time`).toBeUndefined();
  });
});

describe('findRaceClockTakeFormErrors', () => {
  it('finds nothing wrong with a correctly filled form', () => {
    // Arrange: the form filled for the endurance race.
    const formValues = buildFormFilledForTheEnduranceRace();

    // Act: check it.
    const fieldErrors = findRaceClockTakeFormErrors(formValues);

    // Assert: no field has a message.
    expect(fieldErrors, 'a correct form must have no errors').toEqual({});
  });

  it('finds nothing wrong with the starting values, which match the manifest defaults', () => {
    // Arrange: nothing to prepare; the starting values are a constant.

    // Act: check them.
    const fieldErrors = findRaceClockTakeFormErrors(defaultRaceClockTakeFormValues);

    // Assert: they are valid, and they are the defaults race-clock.ograf.json declares.
    expect(fieldErrors, 'the form must open in a state that can be taken').toEqual({});
    expect(
      defaultRaceClockTakeFormValues,
      'the starting values must mirror the defaults in the race clock manifest',
    ).toEqual({
      sessionName: 'Enduro de Resistência',
      state: 'pre',
      clockMode: 'elapsed',
      running: false,
      referenceTime: '0:00',
      lapsCompletedByLeader: '',
    });
  });

  const scenariosWithOneFieldWrong = [
    // The session name is the title of the graphic; an empty band on air is a mistake.
    {
      name: 'asks for the session name when it is empty',
      fieldName: 'sessionName',
      fieldValue: '',
      message: 'Informe o nome da sessão.',
    },
    // Only spaces is the same as empty once it is on screen.
    {
      name: 'asks for the session name when it is only spaces',
      fieldName: 'sessionName',
      fieldValue: '   ',
      message: 'Informe o nome da sessão.',
    },
    // No flag chosen: the graphic cannot pick a colour for its band.
    {
      name: 'asks for the flag when none is chosen',
      fieldName: 'state',
      fieldValue: undefined,
      message: 'Escolha a bandeira.',
    },
    // A flag the race clock does not have (it has six, and blue is not one of them).
    {
      name: 'asks for the flag when the value is not one of the six',
      fieldName: 'state',
      fieldValue: 'blue',
      message: 'Escolha a bandeira.',
    },
    // No clock mode chosen: elapsed and remaining count in opposite directions.
    {
      name: 'asks for the clock mode when none is chosen',
      fieldName: 'clockMode',
      fieldValue: undefined,
      message: 'Escolha o modo do relógio.',
    },
    // The running switch always has a value on screen; this guards the code path only.
    {
      name: 'asks whether the clock is running when the switch has no value',
      fieldName: 'running',
      fieldValue: undefined,
      message: 'Diga se o relógio está correndo ou parado.',
    },
    // The reference time is required: without it the clock has nothing to show.
    {
      name: 'asks for the reference time when it is empty',
      fieldName: 'referenceTime',
      fieldValue: '',
      message: 'Informe o tempo de referência.',
    },
    // Typed, but not as mm:ss: the message shows the expected shape with an example.
    {
      name: 'explains the mm:ss format when the reference time has an hours part',
      fieldName: 'referenceTime',
      fieldValue: '1:00:00',
      message: 'Use minutos e segundos no formato mm:ss, por exemplo 12:30.',
    },
    // Laps are optional, but when typed they must be a whole number.
    {
      name: 'asks for a whole number when the laps are a word',
      fieldName: 'lapsCompletedByLeader',
      fieldValue: 'sete',
      message: 'Informe as voltas como um número inteiro ou deixe em branco.',
    },
    // Half a lap is not a completed lap.
    {
      name: 'asks for a whole number when the laps have a decimal part',
      fieldName: 'lapsCompletedByLeader',
      fieldValue: '7,5',
      message: 'Informe as voltas como um número inteiro ou deixe em branco.',
    },
  ];

  it.each(scenariosWithOneFieldWrong)('$name', ({ fieldName, fieldValue, message }) => {
    // Arrange: a correct form with one field replaced by the scenario's value.
    const formValues = { ...buildFormFilledForTheEnduranceRace(), [fieldName]: fieldValue };

    // Act: check it.
    const fieldErrors = findRaceClockTakeFormErrors(formValues);

    // Assert: only that field has a message, and it is the pt-BR one for that field.
    expect(fieldErrors, `only "${fieldName}" must be reported, with its own message`).toEqual({
      [fieldName]: message,
    });
  });

  it('reports every wrong field at once, so the operator fixes them in one pass', () => {
    // Arrange: a form with the session name and the reference time both empty.
    const formValues = {
      ...buildFormFilledForTheEnduranceRace(),
      sessionName: '',
      referenceTime: '',
    };

    // Act: check it.
    const fieldErrors = findRaceClockTakeFormErrors(formValues);

    // Assert: both fields carry their message.
    expect(fieldErrors, 'both empty fields must be reported together').toEqual({
      sessionName: 'Informe o nome da sessão.',
      referenceTime: 'Informe o tempo de referência.',
    });
  });
});

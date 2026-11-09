/**
 * Reading the simulator form (apps/control)
 *
 * What this module is for:
 *   The simulator form holds text, as fields do ("2", "0,5", "240"). Reading it turns
 *   that text into a source: a label, a poll interval in ms and a config that the shared
 *   SimulatorConfigSchema accepts, the same schema the server checks. Minutes become ms
 *   and seconds become ms here, so the operator never types milliseconds. A field the
 *   schema refuses gets its pt-BR message under it before anything is sent.
 *
 * What these tests prove:
 *   - A filled-in form reads into the label, the interval and the config, with a decimal
 *     comma accepted.
 *   - The form opened on a stored simulator shows its values in the operator's units.
 *   - Each field outside what the schema allows gets its own message.
 *   - "Simular Super Chats" (BAJAOVRLAY-35) is sent only when on: off, the config leaves it
 *     out, as every config saved before the switch does.
 *
 * What these tests deliberately do not cover:
 *   - The commands built from the reading: dataSourceCommandsFromForm.test.ts.
 *   - The messages on the page: DataSourcesPageForms.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import { buildSimulatorThatIsOk } from '@/state/dataSourcesLikeTheServerSends.testSupport';

import {
  buildSimulatorSourceFormValues,
  readSimulatorSourceForm,
  type SimulatorSourceFormValues,
} from './simulatorSourceForm';

/** The form as an operator fills it for a fast rehearsal simulator. */
function buildFormOfARehearsalSimulator(): SimulatorSourceFormValues {
  return {
    label: 'Simulador do ensaio',
    pollIntervalSeconds: '0,5',
    seed: '42',
    carCount: '30',
    sessionDurationMinutes: '90',
    lapLengthKm: '2,4',
    speed: '60',
    isFailing: false,
    areSuperChatsSimulated: false,
  };
}

describe('readSimulatorSourceForm', () => {
  it('reads a filled-in form into a label, an interval in ms and a config', () => {
    // Arrange: the form of a fast rehearsal simulator.
    const formValues = buildFormOfARehearsalSimulator();

    // Act: read it.
    const reading = readSimulatorSourceForm(formValues);

    // Assert: seconds and minutes became ms, the decimal comma was understood.
    expect(reading, 'the form must read into a valid source').toEqual({
      isValid: true,
      label: 'Simulador do ensaio',
      pollIntervalMs: 500,
      config: {
        seed: 42,
        carCount: 30,
        sessionDurationMs: 5_400_000,
        lapLengthKm: 2.4,
        speed: 60,
        isFailing: false,
      },
    });
  });

  const wrongFieldScenarios: {
    name: string;
    change: Partial<SimulatorSourceFormValues>;
    field: keyof SimulatorSourceFormValues;
    message: string;
  }[] = [
    // A source with no name cannot be told apart in the list.
    {
      name: 'a blank label',
      change: { label: '  ' },
      field: 'label',
      message: 'Informe o nome da fonte.',
    },
    // Faster than twice a second would hammer the source.
    {
      name: 'a poll interval of 0,2 s',
      change: { pollIntervalSeconds: '0,2' },
      field: 'pollIntervalSeconds',
      message: 'Informe de 0,5 a 60 segundos.',
    },
    // The fictional team list has a hundred teams and a race needs at least ten.
    {
      name: 'five cars',
      change: { carCount: '5' },
      field: 'carCount',
      message: 'Informe de 10 a 100 carros.',
    },
    // The seed must be a whole number for the seeded generator.
    {
      name: 'a seed with a fraction',
      change: { seed: '20,5' },
      field: 'seed',
      message: 'Informe a semente como um número inteiro de 0 a 4294967295.',
    },
    // The generator reads 32 bits: 2^32 would be seed 0's race under another number.
    {
      name: 'a seed of 4294967296 (2^32)',
      change: { seed: '4294967296' },
      field: 'seed',
      message: 'Informe a semente como um número inteiro de 0 a 4294967295.',
    },
    // A typo with extra zeros: more than a day would block the server on every poll.
    {
      name: 'a session of 100 000 minutes',
      change: { sessionDurationMinutes: '100000' },
      field: 'sessionDurationMinutes',
      message: 'Informe a duração em minutos, maior que zero e até 1440 (24 h).',
    },
    // A lap must have a length.
    {
      name: 'a lap of 0 km',
      change: { lapLengthKm: '0' },
      field: 'lapLengthKm',
      message: 'Informe um comprimento maior que zero.',
    },
    // The simulator runs from real time up to 60 times faster.
    {
      name: 'a speed of 120',
      change: { speed: '120' },
      field: 'speed',
      message: 'Informe um número inteiro de 1 a 60.',
    },
    // An emptied field is not a number at all.
    {
      name: 'an emptied car count',
      change: { carCount: '' },
      field: 'carCount',
      message: 'Informe de 10 a 100 carros.',
    },
  ];

  it.each(wrongFieldScenarios)(
    'refuses $name with its own message',
    ({ change, field, message }) => {
      // Arrange: the rehearsal form with the one wrong field of this row.
      const formValues = { ...buildFormOfARehearsalSimulator(), ...change };

      // Act: read it.
      const reading = readSimulatorSourceForm(formValues);

      // Assert: invalid, with the row's message under that field only.
      expect(reading, `the form must be refused with a message on "${field}"`).toEqual({
        isValid: false,
        errorMessageByField: { [field]: message },
      });
    },
  );
});

describe('buildSimulatorSourceFormValues', () => {
  it("fills the form with a stored simulator's values in the operator's units", () => {
    // Arrange: the seeded simulator, turned on.
    const storedSimulator = buildSimulatorThatIsOk();

    // Act: fill the form from it.
    const formValues = buildSimulatorSourceFormValues(storedSimulator);

    // Assert: seconds, minutes and the decimal comma, as the operator would type them.
    expect(formValues, 'the form must show the stored values').toEqual({
      label: 'Simulador — Enduro',
      pollIntervalSeconds: '2',
      seed: '2027',
      carCount: '60',
      sessionDurationMinutes: '240',
      lapLengthKm: '2',
      speed: '1',
      isFailing: false,
      areSuperChatsSimulated: false,
    });
  });

  it('fills a new form with the schema defaults and no label', () => {
    // Arrange: nothing stored; "+ Fonte" → "Simulador".

    // Act: fill the form for a new simulator.
    const formValues = buildSimulatorSourceFormValues(null);

    // Assert: the defaults of SimulatorConfigSchema and a 2-second interval.
    expect(formValues, 'a new form starts from the defaults').toEqual({
      label: '',
      pollIntervalSeconds: '2',
      seed: '2027',
      carCount: '60',
      sessionDurationMinutes: '240',
      lapLengthKm: '2',
      speed: '1',
      isFailing: false,
      areSuperChatsSimulated: false,
    });
  });
});

describe('the "Simular Super Chats" switch', () => {
  const switchScenarios = [
    // On: the simulator adds a fictional viewer's Super Chat now and then.
    { name: 'sends it when on', isOn: true, expectedField: true },
    // Off: left out, so a config saved before the switch existed reads the same.
    { name: 'leaves it out when off', isOn: false, expectedField: undefined },
  ];

  it.each(switchScenarios)('$name', ({ isOn, expectedField }) => {
    // Arrange: the rehearsal simulator's form with the switch on or off.
    const formValues = { ...buildFormOfARehearsalSimulator(), areSuperChatsSimulated: isOn };

    // Act: read it.
    const reading = readSimulatorSourceForm(formValues);

    // Assert: the config carries the switch only when it is on.
    expect(
      reading.isValid ? reading.config.areSuperChatsSimulated : 'refused',
      'the config must carry the switch only when it is on',
    ).toBe(expectedField);
  });

  it('opens on a stored simulator with the switch as stored', () => {
    // Arrange: the seeded simulator with Super Chats switched on.
    const storedSimulator = buildSimulatorThatIsOk();
    storedSimulator.config.areSuperChatsSimulated = true;

    // Act: fill the form from it.
    const formValues = buildSimulatorSourceFormValues(storedSimulator);

    // Assert: the switch is on.
    expect(formValues.areSuperChatsSimulated, 'the switch must show the stored value').toBe(true);
  });
});

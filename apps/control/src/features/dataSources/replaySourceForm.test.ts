/**
 * Reading the replay form (apps/control)
 *
 * What this module is for:
 *   The replay form ("Reprodução") picks a recording, a speed from the fixed list, whether
 *   to start again at the end and, optionally, how far into the recording to start. Reading
 *   it turns the fields' text into a config the shared ReplayConfigSchema accepts (the one
 *   the server checks): seconds become ms, and an empty offset is left out ("the source
 *   does not say", never 0).
 *
 * What these tests prove:
 *   - A filled-in form reads into the label, the interval and the config.
 *   - An empty offset is left out of the config.
 *   - No recording chosen, and a negative offset, each get their pt-BR message.
 *   - The form opened on a stored replay shows its values in the operator's units.
 *
 * What these tests deliberately do not cover:
 *   - Which recordings the form offers (only ended ones): DataSourcesPageForms.test.tsx.
 *   - The commands built from the reading: dataSourceCommandsFromForm.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { buildRehearsalReplayThatIsOk } from '@/state/dataSourcesLikeTheServerSends.testSupport';

import {
  buildReplaySourceFormValues,
  readReplaySourceForm,
  type ReplaySourceFormValues,
} from './replaySourceForm';

const fridaysRecordingId = 'simulador-enduro/2027-03-19T13-00-00.000Z.jsonl';

/** The form as an operator fills it to rehearse Friday's recording at 10×. */
function buildFormOfFridaysRehearsal(): ReplaySourceFormValues {
  return {
    label: 'Ensaio de sexta',
    pollIntervalSeconds: '2',
    recordingId: fridaysRecordingId,
    speed: '10',
    isLooping: true,
    startOffsetSeconds: '600',
  };
}

describe('readReplaySourceForm', () => {
  it('reads a filled-in form into a label, an interval in ms and a config', () => {
    // Arrange: Friday's rehearsal, starting ten minutes into the recording.
    const formValues = buildFormOfFridaysRehearsal();

    // Act: read it.
    const reading = readReplaySourceForm(formValues);

    // Assert: the speed is a number, the offset in ms.
    expect(reading, 'the form must read into a valid replay').toEqual({
      isValid: true,
      label: 'Ensaio de sexta',
      pollIntervalMs: 2_000,
      config: {
        recordingId: fridaysRecordingId,
        speed: 10,
        isLooping: true,
        startOffsetMs: 600_000,
      },
    });
  });

  it('leaves an empty start offset out of the config', () => {
    // Arrange: the same rehearsal from the top of the recording.
    const formValues = { ...buildFormOfFridaysRehearsal(), startOffsetSeconds: ' ' };

    // Act: read it.
    const reading = readReplaySourceForm(formValues);

    // Assert: no startOffsetMs at all.
    expect(reading, 'an empty offset must be left out, never sent as 0').toEqual({
      isValid: true,
      label: 'Ensaio de sexta',
      pollIntervalMs: 2_000,
      config: { recordingId: fridaysRecordingId, speed: 10, isLooping: true },
    });
  });

  const wrongFieldScenarios: {
    name: string;
    change: Partial<ReplaySourceFormValues>;
    field: keyof ReplaySourceFormValues;
    message: string;
  }[] = [
    // A replay with nothing to play.
    {
      name: 'no recording chosen',
      change: { recordingId: '' },
      field: 'recordingId',
      message: 'Escolha a gravação.',
    },
    // A start before the recording began.
    {
      name: 'a negative start offset',
      change: { startOffsetSeconds: '-30' },
      field: 'startOffsetSeconds',
      message: 'Informe os segundos como um número maior ou igual a zero, ou deixe em branco.',
    },
  ];

  it.each(wrongFieldScenarios)(
    'refuses $name with its own message',
    ({ change, field, message }) => {
      // Arrange: the rehearsal form with the one wrong field of this row.
      const formValues = { ...buildFormOfFridaysRehearsal(), ...change };

      // Act: read it.
      const reading = readReplaySourceForm(formValues);

      // Assert: invalid, with the row's message under that field only.
      expect(reading, `the form must be refused with a message on "${field}"`).toEqual({
        isValid: false,
        errorMessageByField: { [field]: message },
      });
    },
  );
});

describe('buildReplaySourceFormValues', () => {
  it("fills the form with a stored replay's values", () => {
    // Arrange: the rehearsal replay as stored (it has no start offset).
    const storedReplay = buildRehearsalReplayThatIsOk();

    // Act: fill the form from it.
    const formValues = buildReplaySourceFormValues(storedReplay);

    // Assert: the stored values as text, the offset empty.
    expect(formValues, 'the form must show the stored values').toEqual({
      label: 'Ensaio de sexta',
      pollIntervalSeconds: '2',
      recordingId: fridaysRecordingId,
      speed: '10',
      isLooping: true,
      startOffsetSeconds: '',
    });
  });
});

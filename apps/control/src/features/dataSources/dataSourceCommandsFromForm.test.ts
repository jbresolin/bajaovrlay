/**
 * The commands "Salvar fonte" sends (apps/control)
 *
 * What this module is for:
 *   Once a source form passed its checks, "Salvar fonte" sends `createDataSource` for a
 *   new source (all of it) or `updateDataSource` for a stored one, carrying only what
 *   the operator changed, so two operators who edit different parts of one source both
 *   keep their change. A changed config is sent whole, because the server replaces the
 *   whole config; the moment the race or the replay started is the server's and is never
 *   compared or sent from the page.
 *
 * What these tests prove:
 *   - createDataSource carries the label, the kind, the config and the poll interval.
 *   - updateDataSource carries only the label, the poll interval or the config that
 *     differ, and nothing at all is sent when nothing changed.
 *   - The start moment stored by the server does not count as a change, and a cleared
 *     optional field (the replay's start offset) does.
 *
 * What these tests deliberately do not cover:
 *   - Reading the form's text into numbers and its pt-BR messages:
 *     simulatorSourceForm.test.ts and replaySourceForm.test.ts.
 *   - The press on the page and the server's answer: DataSourcesPageForms.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import {
  buildRehearsalReplayThatIsOk,
  buildSimulatorThatIsOk,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import {
  buildCreateDataSourceCommand,
  buildUpdateDataSourceCommand,
  type DataSourceFormReading,
} from './dataSourceCommandsFromForm';

/** What the simulator form reads when the operator leaves every default and names it. */
function buildReadingOfASimulatorAtSpeed60(): DataSourceFormReading {
  return {
    label: 'Simulador rápido',
    pollIntervalMs: 2_000,
    config: {
      seed: 2027,
      carCount: 60,
      sessionDurationMs: 14_400_000,
      lapLengthKm: 2,
      speed: 60,
      isFailing: false,
    },
  };
}

/** What the simulator form reads when opened on the stored simulator and left as it is. */
function buildReadingOfTheStoredSimulatorUnchanged(): DataSourceFormReading {
  return {
    label: 'Simulador — Enduro',
    pollIntervalMs: 2_000,
    config: {
      seed: 2027,
      carCount: 60,
      sessionDurationMs: 14_400_000,
      lapLengthKm: 2,
      speed: 1,
      isFailing: false,
    },
  };
}

describe('buildCreateDataSourceCommand', () => {
  it('carries the label, the kind, the config and the poll interval of a new simulator', () => {
    // Arrange: a new simulator at speed 60, read from the form.
    const reading = buildReadingOfASimulatorAtSpeed60();

    // Act: build the command.
    const command = buildCreateDataSourceCommand('simulator', reading);

    // Assert: the whole source; the server gives it its id.
    expect(command, 'a new source is sent whole').toEqual({
      type: 'createDataSource',
      label: 'Simulador rápido',
      kind: 'simulator',
      config: {
        seed: 2027,
        carCount: 60,
        sessionDurationMs: 14_400_000,
        lapLengthKm: 2,
        speed: 60,
        isFailing: false,
      },
      pollIntervalMs: 2_000,
    });
  });
});

describe('buildUpdateDataSourceCommand', () => {
  it('sends nothing when nothing changed, whatever start moment the server stored', () => {
    // Arrange: the stored simulator (its race started at 11:30) and the form left as it is.
    const storedSimulator = buildSimulatorThatIsOk();
    const reading = buildReadingOfTheStoredSimulatorUnchanged();

    // Act: build the command.
    const command = buildUpdateDataSourceCommand(storedSimulator, reading);

    // Assert: nothing to send; the start moment is not a change the operator made.
    expect(command, 'an unchanged form must send nothing').toBeUndefined();
  });

  it('sends only the label when only the label changed', () => {
    // Arrange: the stored simulator renamed in the form.
    const storedSimulator = buildSimulatorThatIsOk();
    const reading = { ...buildReadingOfTheStoredSimulatorUnchanged(), label: 'Simulador da TV' };

    // Act: build the command.
    const command = buildUpdateDataSourceCommand(storedSimulator, reading);

    // Assert: the new label and nothing else.
    expect(command, 'only the changed label is sent').toEqual({
      type: 'updateDataSource',
      sourceId: 'simulador-enduro',
      label: 'Simulador da TV',
    });
  });

  it('sends the whole config when one of its fields changed', () => {
    // Arrange: the stored simulator with "Falha simulada" switched on in the form.
    const storedSimulator = buildSimulatorThatIsOk();
    const unchangedReading = buildReadingOfTheStoredSimulatorUnchanged();
    const reading = {
      ...unchangedReading,
      config: { ...unchangedReading.config, isFailing: true },
      pollIntervalMs: 1_000,
    };

    // Act: build the command.
    const command = buildUpdateDataSourceCommand(storedSimulator, reading);

    // Assert: the whole config from the form, without the server's start moment, and
    // the new interval.
    expect(command, 'a changed config is sent whole, a changed interval too').toEqual({
      type: 'updateDataSource',
      sourceId: 'simulador-enduro',
      config: {
        seed: 2027,
        carCount: 60,
        sessionDurationMs: 14_400_000,
        lapLengthKm: 2,
        speed: 1,
        isFailing: true,
      },
      pollIntervalMs: 1_000,
    });
  });

  it('counts a cleared optional field as a change', () => {
    // Arrange: the rehearsal replay, stored with a start offset of 10 min, and the form
    // with that field emptied.
    const storedReplay = buildRehearsalReplayThatIsOk();
    storedReplay.config.startOffsetMs = 600_000;
    const reading: DataSourceFormReading = {
      label: 'Ensaio de sexta',
      pollIntervalMs: 2_000,
      config: { recordingId: storedReplay.config.recordingId, speed: 10, isLooping: true },
    };

    // Act: build the command.
    const command = buildUpdateDataSourceCommand(storedReplay, reading);

    // Assert: the config without the offset, so the replay starts from the top.
    expect(command, 'emptying the start offset must send the config without it').toEqual({
      type: 'updateDataSource',
      sourceId: 'reproducao-ensaio',
      config: {
        recordingId: 'simulador-enduro/2027-03-19T13-00-00.000Z.jsonl',
        speed: 10,
        isLooping: true,
      },
    });
  });
});

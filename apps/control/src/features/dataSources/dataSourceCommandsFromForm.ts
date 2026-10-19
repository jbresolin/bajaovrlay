/**
 * The two commands "Salvar fonte" can send, built from a form that already passed its
 * checks: `createDataSource` for a new source (all of it) and `updateDataSource` for a
 * stored one (only what differs from the source as it was when the form opened). Pure
 * functions, like the macro editor's (features/macros/macroCommandsFromEditor.ts).
 *
 * The config is one part: updateDataSource replaces the whole config, so a change to any
 * of its fields sends the whole config from the form. The moment the race or the replay
 * started is set and kept by the server; the form never holds it, so it is not compared.
 */
import {
  areJsonValuesEqual,
  type CreateDataSourceCommand,
  type DataSource,
  type DataSourceKind,
  type HttpJsonConfig,
  type UpdateDataSourceCommand,
} from '@bajaovrlay/shared';

import type { ReplayConfigFromForm } from './replaySourceForm';
import type { SimulatorConfigFromForm } from './simulatorSourceForm';

/** What a valid form of any kind reads into. */
export type DataSourceFormReading = {
  label: string;
  pollIntervalMs: number;
  config: SimulatorConfigFromForm | ReplayConfigFromForm | HttpJsonConfig;
};

// The config fields only the server writes: the start of the simulated race or the replay.
const configFieldsSetByTheServer = ['simulatedStartAtMs', 'replayStartedAtMs'];

/**
 * Answers whether the form's config differs from the stored one in any field the form
 * holds, including a field the operator emptied (an optional one now left out). Values
 * are compared by content (areJsonValuesEqual), because a flex config's requests and
 * mappings are lists and objects that the form builds anew, never the stored ones.
 */
function hasConfigChanged(
  storedConfig: Record<string, unknown>,
  configFromForm: Record<string, unknown>,
): boolean {
  const fieldNamesOfBoth = new Set([...Object.keys(storedConfig), ...Object.keys(configFromForm)]);
  for (const fieldName of fieldNamesOfBoth) {
    if (configFieldsSetByTheServer.includes(fieldName)) {
      continue;
    }
    if (!areJsonValuesEqual(storedConfig[fieldName], configFromForm[fieldName])) {
      return true;
    }
  }
  return false;
}

/** Builds `createDataSource` for a new source of `kind`; the server gives it its id. */
export function buildCreateDataSourceCommand(
  kind: DataSourceKind,
  reading: DataSourceFormReading,
): CreateDataSourceCommand {
  return {
    type: 'createDataSource',
    label: reading.label,
    kind,
    config: reading.config,
    pollIntervalMs: reading.pollIntervalMs,
  };
}

/**
 * Builds `updateDataSource` with only the label, interval and config that differ from
 * the source as opened. Undefined when nothing differs, so the caller sends nothing.
 */
export function buildUpdateDataSourceCommand(
  sourceAsOpened: DataSource,
  reading: DataSourceFormReading,
): UpdateDataSourceCommand | undefined {
  const command: UpdateDataSourceCommand = {
    type: 'updateDataSource',
    sourceId: sourceAsOpened.id,
  };
  if (reading.label !== sourceAsOpened.label) {
    command.label = reading.label;
  }
  if (reading.pollIntervalMs !== sourceAsOpened.pollIntervalMs) {
    command.pollIntervalMs = reading.pollIntervalMs;
  }
  if (hasConfigChanged(sourceAsOpened.config, reading.config)) {
    command.config = reading.config;
  }

  const isAnythingChanged =
    command.label !== undefined ||
    command.pollIntervalMs !== undefined ||
    command.config !== undefined;
  return isAnythingChanged ? command : undefined;
}

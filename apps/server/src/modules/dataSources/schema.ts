// The module's side of the data-source schemas: checking a config sent by the page
// against the schema of its kind. The schemas themselves live in @bajaovrlay/shared
// (SimulatorConfigSchema, ReplayConfigSchema), so the control page's forms and the
// adapters check exactly the same thing (decision D4).
import {
  type CommandError,
  type DataSourceKind,
  type Recording,
  type ReplayConfig,
  ReplayConfigSchema,
  type SimulatorConfig,
  SimulatorConfigSchema,
} from '@bajaovrlay/shared';

import { refuseInvalidDataSourceConfig, refuseUnknownRecording } from './dataSourceRefusals.js';

/** A kind with a config of that kind, ready to be spread into a DataSource. */
export type DataSourceKindAndConfig =
  { kind: 'simulator'; config: SimulatorConfig } | { kind: 'replay'; config: ReplayConfig };

/** The answer of checkDataSourceConfig: the parsed config, or the refusal to send. */
export type DataSourceConfigCheck =
  | { isValid: true; kindAndConfig: DataSourceKindAndConfig }
  | { isValid: false; error: CommandError };

/**
 * Parses a config sent by the page with the schema of its kind, filling in defaults, so
 * the stored config is always complete. The timeline start (simulatedStartAtMs,
 * replayStartedAtMs) is dropped: only the server sets it, so a page that sends back the
 * whole config it read cannot rewind a race or a replay. A replay may only name a
 * recording that exists and is closed: one still being recorded has no end yet, and
 * replaying it would chase a file that is still growing.
 */
export function checkDataSourceConfig(
  kind: DataSourceKind,
  rawConfig: unknown,
  recordings: Recording[],
): DataSourceConfigCheck {
  switch (kind) {
    case 'simulator': {
      const parsedConfig = SimulatorConfigSchema.safeParse(rawConfig);
      if (!parsedConfig.success) {
        const badFieldPath = parsedConfig.error.issues[0]?.path ?? [];
        return { isValid: false, error: refuseInvalidDataSourceConfig(badFieldPath) };
      }
      const configSetByTheOperator = { ...parsedConfig.data };
      delete configSetByTheOperator.simulatedStartAtMs;
      return {
        isValid: true,
        kindAndConfig: { kind: 'simulator', config: configSetByTheOperator },
      };
    }
    case 'replay': {
      const parsedConfig = ReplayConfigSchema.safeParse(rawConfig);
      if (!parsedConfig.success) {
        const badFieldPath = parsedConfig.error.issues[0]?.path ?? [];
        return { isValid: false, error: refuseInvalidDataSourceConfig(badFieldPath) };
      }
      const recordingId = parsedConfig.data.recordingId;
      const isRecordingReadyToReplay = recordings.some(
        (recording) => recording.id === recordingId && recording.endedAtMs !== null,
      );
      if (!isRecordingReadyToReplay) {
        return { isValid: false, error: refuseUnknownRecording(recordingId) };
      }
      const configSetByTheOperator = { ...parsedConfig.data };
      delete configSetByTheOperator.replayStartedAtMs;
      return { isValid: true, kindAndConfig: { kind: 'replay', config: configSetByTheOperator } };
    }
  }
}

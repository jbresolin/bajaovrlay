// The module's side of the data-source schemas: checking a config sent by the page
// against the schema of its kind, and the Zod schemas of the module's REST route. The
// slice and command schemas themselves live in @bajaovrlay/shared
// (SimulatorConfigSchema, ReplayConfigSchema, HttpJsonConfigSchema), so the control page's forms and the
// adapters check exactly the same thing (decision D4).
import {
  type CommandError,
  type DataSourceKind,
  type HttpJsonConfig,
  HttpJsonConfigSchema,
  type Recording,
  type ReplayConfig,
  ReplayConfigSchema,
  type SimulatorConfig,
  SimulatorConfigSchema,
} from '@bajaovrlay/shared';
import { z } from 'zod';

import {
  findFirstRequestToAHostNotAllowed,
  type SourceHostAllowlist,
} from './adapters/httpJson/sourceHostAllowlist.js';
import {
  refuseHostNotAllowed,
  refuseInvalidDataSourceConfig,
  refuseUnknownRecording,
} from './dataSourceRefusals.js';

/** A kind with a config of that kind, ready to be spread into a DataSource. */
export type DataSourceKindAndConfig =
  | { kind: 'simulator'; config: SimulatorConfig }
  | { kind: 'replay'; config: ReplayConfig }
  | { kind: 'httpJson'; config: HttpJsonConfig };

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
 * replaying it would chase a file that is still growing. A flex source may only read
 * hosts on BAJAOVRLAY_SOURCE_ALLOWED_HOSTS when that list is set (the reducer context
 * carries it from the boot).
 */
export function checkDataSourceConfig(
  kind: DataSourceKind,
  rawConfig: unknown,
  recordings: Recording[],
  sourceHostAllowlist: SourceHostAllowlist,
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
    case 'httpJson': {
      // A flex source has no timeline of its own and nothing the server sets: the
      // config is stored exactly as parsed (its header and query lists filled in).
      const parsedConfig = HttpJsonConfigSchema.safeParse(rawConfig);
      if (!parsedConfig.success) {
        const badFieldPath = parsedConfig.error.issues[0]?.path ?? [];
        return { isValid: false, error: refuseInvalidDataSourceConfig(badFieldPath) };
      }
      // Checked on save as well as at every request, so "Salvar" says it at once. With no
      // list set nothing is refused here: any host is allowed, and a request naming a
      // variable is refused when it is built, not when it is saved.
      const requestNotAllowed = findFirstRequestToAHostNotAllowed(
        parsedConfig.data.requests,
        sourceHostAllowlist,
      );
      if (requestNotAllowed !== undefined) {
        return {
          isValid: false,
          error: refuseHostNotAllowed(requestNotAllowed.host, requestNotAllowed.requestId),
        };
      }
      return { isValid: true, kindAndConfig: { kind: 'httpJson', config: parsedConfig.data } };
    }
  }
}

/** The path parameters of GET /api/v1/data-sources/{sourceId}/snapshot. */
export const DataSnapshotRouteParamsSchema = z.object({
  sourceId: z.string().min(1),
});

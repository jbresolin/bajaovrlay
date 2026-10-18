// When a source's timeline starts: the simulated race of a simulator, the playback of a
// replay. Both are moments in the config, set by the server, never by the page (the
// config check drops them from what the page sends).
import type { DataSource } from '@bajaovrlay/shared';

import type { DataSourceKindAndConfig } from './schema.js';

/**
 * Starts the timeline of a source being turned on (decision D5): a simulator's race
 * starts now only when it never started, so it carries on where wall time puts it (as
 * after a restart); a replay starts again from the top every time, because every
 * rehearsal starts from the beginning.
 */
export function startTheTimelineAtEnable(source: DataSource, nowMs: number): DataSource {
  switch (source.kind) {
    case 'simulator': {
      const hasTheRaceStarted = source.config.simulatedStartAtMs !== undefined;
      if (hasTheRaceStarted) {
        return source;
      }
      return { ...source, config: { ...source.config, simulatedStartAtMs: nowMs } };
    }
    case 'replay':
      return { ...source, config: { ...source.config, replayStartedAtMs: nowMs } };
  }
}

/**
 * The timeline start an edited config carries. The edited config never has one (the page
 * may not set it; see checkDataSourceConfig), so the stored start is carried over and
 * saving the edit form (to switch "falha simulada" on, say) does not restart the race or
 * the replay. One exception: a replay whose recording, start offset or speed changed
 * starts again from the top at the moment of the edit, because keeping the old start
 * would jump the new playback to "time since the old start × speed", maybe past its end
 * (decision D5: every rehearsal starts from the beginning). A replay that is off gets its
 * start set again when it is turned on, so this start only matters for one that is on.
 */
export function carryTheTimelineStartIntoTheEdit(
  storedSource: DataSource,
  editedKindAndConfig: DataSourceKindAndConfig,
  nowMs: number,
): DataSourceKindAndConfig {
  if (storedSource.kind === 'simulator' && editedKindAndConfig.kind === 'simulator') {
    const storedStartAtMs = storedSource.config.simulatedStartAtMs;
    if (storedStartAtMs === undefined) {
      return editedKindAndConfig;
    }
    return {
      kind: 'simulator',
      config: { ...editedKindAndConfig.config, simulatedStartAtMs: storedStartAtMs },
    };
  }
  if (storedSource.kind === 'replay' && editedKindAndConfig.kind === 'replay') {
    const storedStartedAtMs = storedSource.config.replayStartedAtMs;
    if (storedStartedAtMs === undefined) {
      return editedKindAndConfig;
    }
    const storedConfig = storedSource.config;
    const editedConfig = editedKindAndConfig.config;
    const isSamePlayback =
      storedConfig.recordingId === editedConfig.recordingId &&
      storedConfig.startOffsetMs === editedConfig.startOffsetMs &&
      storedConfig.speed === editedConfig.speed;
    const replayStartedAtMs = isSamePlayback ? storedStartedAtMs : nowMs;
    return { kind: 'replay', config: { ...editedConfig, replayStartedAtMs } };
  }
  return editedKindAndConfig;
}

import type { RestartSimulatedRaceCommand } from '@bajaovrlay/shared';

import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { findDataSource, replaceDataSource } from '../dataSourceListing.js';
import {
  refuseDataSourceThatIsNotASimulator,
  refuseDisabledDataSource,
  refuseUnknownDataSource,
} from '../dataSourceRefusals.js';

/**
 * restartSimulatedRace ("Reiniciar corrida", João's ruling 3 at gate 2 of PR #16): moves
 * a simulator's race start (`config.simulatedStartAtMs`) to now, so the first poll that
 * starts after it answers the green flag again, within one poll interval. Nothing else
 * changes: the last snapshot stays until that poll (rule 4), since the adapter reads the
 * start when each poll starts. What could go wrong: a poll already in flight read the old
 * start, so its answer (the old race, say the checkered flag) is stored after the restart
 * and a running recording gets that line too; the poll after it is the restarted race.
 * Not fixed on purpose: stamping a "poll now" would not help, as the poller ignores one
 * while a poll is in flight. Refused for an unknown source, for a replay (no race of its
 * own) and for a simulator that is off: turning it on decides where its race is (decision
 * D5), and a start set while it is off would have the race already running when it is
 * turned on.
 */
export function reduceRestartSimulatedRace(
  slices: SlicesChangedByCommands,
  command: RestartSimulatedRaceCommand,
  context: ReducerContext,
): ReducerOutcome {
  const source = findDataSource(slices.dataSources, command.sourceId);
  if (source === undefined) {
    return { status: 'refused', error: refuseUnknownDataSource(command.sourceId) };
  }
  if (source.kind !== 'simulator') {
    return { status: 'refused', error: refuseDataSourceThatIsNotASimulator(source.label) };
  }
  if (!source.isEnabled) {
    return { status: 'refused', error: refuseDisabledDataSource(source.label) };
  }

  const simulatedStartAtMs = Date.parse(context.now);
  // A restarted race lists its cars again from the start: its next poll counts as a first
  // one, so a race with nobody on track yet is not refused as a blanked list.
  const restartedSimulator = {
    ...source,
    config: { ...source.config, simulatedStartAtMs },
    status: { ...source.status, isNextPollAFirstPoll: true as const },
  };
  const dataSources = replaceDataSource(slices.dataSources, restartedSimulator);
  return { status: 'applied', slices: { ...slices, dataSources } };
}

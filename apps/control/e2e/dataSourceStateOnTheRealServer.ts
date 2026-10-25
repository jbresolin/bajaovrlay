// Test support: what the data source test files read from the real server's state
// (GET /api/v1/state) instead of sleeping, so a test waits exactly as long as the server
// needs: one source by its label, the flag and the positions its last poll sent, how many
// graphics are on the outputs, what is on air on one layer (its data, and the instance
// itself), how many polls failed in a row, and how many lines the open recording holds.
// The page steps (clicks, forms, tables) live in dataSourcesTestSteps.ts. Functions only;
// nothing here remembers anything between calls or between tests.
import { expect } from '@playwright/test';

import { realServerPort } from './emptyTheServerState';

/** The parts of a data source the tests read from GET /api/v1/state. */
type DataSourceAsTheTestsReadIt = {
  id: string;
  label: string;
  config: { simulatedStartAtMs?: number };
  status: { consecutiveFailures: number; lastOkAtMs?: number; lastError: string | null };
};

/** The parts of a recording the tests read from GET /api/v1/state. */
type RecordingAsTheTestsReadIt = {
  sourceId: string;
  endedAtMs: number | null;
  snapshotCount: number;
};

/** The parts of an instance the tests read: which one it is, where it is and the data it shows. */
type InstanceAsTheTestsReadIt = {
  id: string;
  layerId: string;
  target: string;
  resolvedData: Record<string, unknown>;
};

/** One car of the positions a source sent, as the tests read it: its number alone. */
export type PositionEntryAsTheTestsReadIt = {
  carNumber: number;
  teamName: string;
  /** The interval to the car ahead, once the leader has a lap (the battle card's gap). */
  intervalMs?: number;
};

/** One round of a source's brackets, as the tests read it: its name and its winners. */
export type BracketRoundAsTheTestsReadIt = {
  name: string;
  matches: Array<{ winnerCarNumber?: number }>;
};

/**
 * The parts of a source's last good data the tests read: its session's flag, its positions
 * and the rounds of its brackets (the simulator's Super Prime, BAJAOVRLAY-25).
 */
type DataSnapshotAsTheTestsReadIt = {
  sourceId: string;
  shapes: {
    session?: { state: string };
    positions?: { entries: PositionEntryAsTheTestsReadIt[] };
    brackets?: { rounds: BracketRoundAsTheTestsReadIt[] };
  };
};

/** The parts of GET /api/v1/state the data source tests read. */
type StateTheDataSourceTestsRead = {
  instances: InstanceAsTheTestsReadIt[];
  dataSources: DataSourceAsTheTestsReadIt[];
  dataSnapshots: DataSnapshotAsTheTestsReadIt[];
  recordings: RecordingAsTheTestsReadIt[];
};

/** Asks the real server for its state, as GET /api/v1/state answers the control page. */
async function readStateFromTheRealServer(): Promise<StateTheDataSourceTestsRead> {
  const response = await fetch(`http://127.0.0.1:${realServerPort}/api/v1/state`);
  if (!response.ok) {
    throw new Error(`GET /api/v1/state answered ${response.status} on the real server`);
  }
  return (await response.json()) as StateTheDataSourceTestsRead;
}

/** Reads one source from the real server's state, by the label the operator gave it. */
export async function readDataSourceFromTheRealServer(
  sourceLabel: string,
): Promise<DataSourceAsTheTestsReadIt> {
  const state = await readStateFromTheRealServer();
  const source = state.dataSources.find((dataSource) => dataSource.label === sourceLabel);
  if (source === undefined) {
    throw new Error(`the real server has no data source named "${sourceLabel}"`);
  }
  return source;
}

/**
 * Asks the real server how many graphics it has on its outputs (program and preview),
 * as GET /api/v1/state answers it: the data source pages must never change that.
 */
export async function countGraphicsOnTheOutputsOfTheRealServer(): Promise<number> {
  const state = await readStateFromTheRealServer();
  return state.instances.length;
}

/**
 * Reads the data the real server has on air on one layer's program output (what OBS
 * draws), or undefined when nothing is there: how a bound graphic is followed on air
 * without reading the renderer's drawing.
 */
export async function readDataOnAirOfLayerFromTheRealServer(
  layerId: string,
): Promise<Record<string, unknown> | undefined> {
  const state = await readStateFromTheRealServer();
  const instanceOnAir = state.instances.find(
    (instance) => instance.layerId === layerId && instance.target === 'program',
  );
  return instanceOnAir?.resolvedData;
}

/**
 * Reads the instance the real server has on one layer's program output (what OBS draws),
 * or undefined when nothing is there: its id, to tell an instance changed in place from
 * one taken again, and the data it shows.
 */
export async function readInstanceOnAirOfLayerFromTheRealServer(
  layerId: string,
): Promise<{ id: string; resolvedData: Record<string, unknown> } | undefined> {
  const state = await readStateFromTheRealServer();
  const instanceOnAir = state.instances.find(
    (instance) => instance.layerId === layerId && instance.target === 'program',
  );
  if (instanceOnAir === undefined) {
    return undefined;
  }
  return { id: instanceOnAir.id, resolvedData: instanceOnAir.resolvedData };
}

/**
 * Reads the positions a source last sent, in the order of the race (first place first),
 * as the real server holds them; an empty list before its first good poll or for a
 * source without positions. What the source says, before any refresh puts it on air.
 */
export async function readPositionsOfSourceFromTheRealServer(
  sourceLabel: string,
): Promise<PositionEntryAsTheTestsReadIt[]> {
  const state = await readStateFromTheRealServer();
  const source = state.dataSources.find((dataSource) => dataSource.label === sourceLabel);
  const snapshot = state.dataSnapshots.find((candidate) => candidate.sourceId === source?.id);
  return snapshot?.shapes.positions?.entries ?? [];
}

/**
 * Reads the rounds of the brackets a source last sent, as the real server holds them; an
 * empty list before its first good poll or for a source without brackets.
 */
export async function readBracketRoundsOfSourceFromTheRealServer(
  sourceLabel: string,
): Promise<BracketRoundAsTheTestsReadIt[]> {
  const state = await readStateFromTheRealServer();
  const source = state.dataSources.find((dataSource) => dataSource.label === sourceLabel);
  const snapshot = state.dataSnapshots.find((candidate) => candidate.sourceId === source?.id);
  return snapshot?.shapes.brackets?.rounds ?? [];
}

/**
 * Reads the flag of the session a source last sent, as the real server holds it, or
 * undefined before its first good poll: what the source says, before any refresh puts it
 * on air.
 */
export async function readSessionFlagOfSourceFromTheRealServer(
  sourceLabel: string,
): Promise<string | undefined> {
  const state = await readStateFromTheRealServer();
  const source = state.dataSources.find((dataSource) => dataSource.label === sourceLabel);
  const snapshot = state.dataSnapshots.find((candidate) => candidate.sourceId === source?.id);
  return snapshot?.shapes.session?.state;
}

/**
 * Waits until the real server counts at least `failureCount` failed polls in a row for a
 * source (`status.consecutiveFailures`): proof that several polls failed, without sleeping.
 */
export async function waitUntilTheSourceHasFailedPollsInARow(wait: {
  sourceLabel: string;
  failureCount: number;
  failureMessage: string;
  timeoutInMilliseconds: number;
}): Promise<void> {
  await expect
    .poll(
      async () => {
        const source = await readDataSourceFromTheRealServer(wait.sourceLabel);
        return source.status.consecutiveFailures;
      },
      { message: wait.failureMessage, timeout: wait.timeoutInMilliseconds },
    )
    .toBeGreaterThanOrEqual(wait.failureCount);
}

/**
 * Waits until the recording a source is still writing (no end yet) holds at least
 * `snapshotCount` lines, as the real server counts them once each line is on disk.
 */
export async function waitUntilTheOpenRecordingHasSnapshots(wait: {
  sourceLabel: string;
  snapshotCount: number;
  failureMessage: string;
  timeoutInMilliseconds: number;
}): Promise<void> {
  const source = await readDataSourceFromTheRealServer(wait.sourceLabel);
  await expect
    .poll(
      async () => {
        const state = await readStateFromTheRealServer();
        const openRecording = state.recordings.find(
          (recording) => recording.sourceId === source.id && recording.endedAtMs === null,
        );
        return openRecording?.snapshotCount ?? 0;
      },
      { message: wait.failureMessage, timeout: wait.timeoutInMilliseconds },
    )
    .toBeGreaterThanOrEqual(wait.snapshotCount);
}

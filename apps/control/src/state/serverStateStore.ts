import {
  type ChangedSlices,
  type DataSnapshot,
  type DataSnapshotMessage,
  mergeChangedSlicesIntoSlices,
  obsSliceWithoutObs,
  type SliceMessage,
  type Slices,
  triggerActivityAtBoot,
} from '@bajaovrlay/shared';
import { createStore, type StoreApi } from 'zustand/vanilla';

import type { LastCommandError } from './commandFailure';

/**
 * How the WebSocket is doing: `connecting` until the first hello, `connected` once the
 * page holds the server's state, `reconnecting` after the line dropped.
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

/**
 * Everything the control page knows: every slice of the server, mirrored as received,
 * plus three facts about the page itself (connection status, last failed command, how far
 * the server clock is off real time). The
 * functions are the only ways to change it, and only serverConnection.ts calls them.
 */
export type ServerState = Slices & {
  connectionStatus: ConnectionStatus;
  lastCommandError: LastCommandError | null;
  /**
   * How many whole seconds the server clock is off real time by NTP, from the last
   * `time` message, once that is 2 s or more (positive: behind); null below that, or
   * when not known. The header warns while it is set (BAJAOVRLAY-62).
   */
  serverClockSecondsOffRealTime: number | null;
  /** A hello arrived: every slice becomes what the server sent. */
  replaceEverySlice: (slices: Slices) => void;
  /** A slice message arrived: that one slice becomes what the server sent. */
  replaceOneSlice: (message: SliceMessage) => void;
  /**
   * A slices message arrived (one state change that changed several slices): each of
   * them becomes what the server sent, all in ONE store update.
   */
  replaceSeveralSlices: (changedSlices: ChangedSlices) => void;
  /**
   * A dataSnapshot message arrived: that one source's entry of `dataSnapshots` becomes
   * what the server sent (added when new, removed on null); every other entry stays.
   */
  mergeOneDataSnapshot: (message: DataSnapshotMessage) => void;
  changeConnectionStatus: (connectionStatus: ConnectionStatus) => void;
  /** A `time` message arrived: how far the server clock is from real time, in ms or unknown. */
  noteServerClockOffRealTime: (offFromRealTimeMs: number | undefined) => void;
  rememberCommandError: (commandError: LastCommandError) => void;
  forgetCommandError: () => void;
};

/** The store object: `getState()` to read, `subscribe()` to be told of changes. */
export type ServerStateStore = StoreApi<ServerState>;

/**
 * Builds an empty store: no slices yet, still connecting. The page builds exactly one
 * (main.tsx); each test builds its own so tests never share state.
 */
export function createServerStateStore(): ServerStateStore {
  return createStore<ServerState>()((set) => ({
    outputs: [],
    layers: [],
    graphics: [],
    instances: [],
    previewClearedLayerIds: [],
    instanceBindings: [],
    programHistory: [],
    rundowns: [],
    items: [],
    quickFirePanels: [],
    macros: [],
    macroRuns: [],
    macroStops: [],
    // Until the hello: OBS unknown, shown as "OBS não configurado" for that moment.
    obs: obsSliceWithoutObs,
    // Until the hello: no trigger, unpaused, as every boot of the server starts.
    triggers: [],
    triggerActivity: triggerActivityAtBoot,
    dataSources: [],
    dataSnapshots: [],
    overrides: [],
    bracketMatchFocuses: [],
    recordings: [],
    events: [],
    eventRules: [],
    teams: [],
    people: [],
    sponsors: [],
    scheduleSlots: [],
    media: [],
    eventLog: [],
    connectionStatus: 'connecting',
    lastCommandError: null,
    serverClockSecondsOffRealTime: null,

    replaceEverySlice: (slices) => {
      set({
        outputs: slices.outputs,
        layers: slices.layers,
        graphics: slices.graphics,
        instances: slices.instances,
        previewClearedLayerIds: slices.previewClearedLayerIds,
        instanceBindings: slices.instanceBindings,
        programHistory: slices.programHistory,
        rundowns: slices.rundowns,
        items: slices.items,
        quickFirePanels: slices.quickFirePanels,
        macros: slices.macros,
        macroRuns: slices.macroRuns,
        macroStops: slices.macroStops,
        obs: slices.obs,
        triggers: slices.triggers,
        triggerActivity: slices.triggerActivity,
        dataSources: slices.dataSources,
        dataSnapshots: slices.dataSnapshots,
        overrides: slices.overrides,
        bracketMatchFocuses: slices.bracketMatchFocuses,
        recordings: slices.recordings,
        events: slices.events,
        eventRules: slices.eventRules,
        teams: slices.teams,
        people: slices.people,
        sponsors: slices.sponsors,
        scheduleSlots: slices.scheduleSlots,
        media: slices.media,
        eventLog: slices.eventLog,
      });
    },

    // One case per slice name, written out, so the compiler checks that each name
    // stores the kind of list that belongs to it. A slice is never merged: what the
    // server sent replaces what was there, because the server owns the truth.
    replaceOneSlice: (message) => {
      switch (message.name) {
        case 'outputs':
          set({ outputs: message.slice });
          break;
        case 'layers':
          set({ layers: message.slice });
          break;
        case 'graphics':
          set({ graphics: message.slice });
          break;
        case 'instances':
          set({ instances: message.slice });
          break;
        case 'previewClearedLayerIds':
          set({ previewClearedLayerIds: message.slice });
          break;
        case 'instanceBindings':
          set({ instanceBindings: message.slice });
          break;
        case 'programHistory':
          set({ programHistory: message.slice });
          break;
        case 'rundowns':
          set({ rundowns: message.slice });
          break;
        case 'items':
          set({ items: message.slice });
          break;
        case 'quickFirePanels':
          set({ quickFirePanels: message.slice });
          break;
        case 'macros':
          set({ macros: message.slice });
          break;
        case 'macroRuns':
          set({ macroRuns: message.slice });
          break;
        case 'macroStops':
          set({ macroStops: message.slice });
          break;
        case 'obs':
          set({ obs: message.slice });
          break;
        case 'dataSources':
          set({ dataSources: message.slice });
          break;
        case 'overrides':
          set({ overrides: message.slice });
          break;
        case 'bracketMatchFocuses':
          set({ bracketMatchFocuses: message.slice });
          break;
        case 'triggers':
          set({ triggers: message.slice });
          break;
        case 'triggerActivity':
          set({ triggerActivity: message.slice });
          break;
        case 'recordings':
          set({ recordings: message.slice });
          break;
        case 'events':
          set({ events: message.slice });
          break;
        case 'eventRules':
          set({ eventRules: message.slice });
          break;
        case 'teams':
          set({ teams: message.slice });
          break;
        case 'people':
          set({ people: message.slice });
          break;
        case 'sponsors':
          set({ sponsors: message.slice });
          break;
        case 'scheduleSlots':
          set({ scheduleSlots: message.slice });
          break;
        case 'media':
          set({ media: message.slice });
          break;
        case 'eventLog':
          set({ eventLog: message.slice });
          break;
        default: {
          // A slice added to the protocol without its case here stops the build: its
          // changes would otherwise never reach the page (the outputs slice of
          // BAJAOVRLAY-49 was missed this way until a test of its page found it).
          const sliceNameWithoutItsCase: never = message;
          throw new Error(`no case for slice ${JSON.stringify(sliceNameWithoutItsCase)}`);
        }
      }
    },

    // One `set`, so every subscriber is told once and already sees every slice of the
    // change: told slice by slice, a component would draw the moment between them.
    replaceSeveralSlices: (changedSlices) => {
      set((state) => mergeChangedSlicesIntoSlices(state, changedSlices));
    },

    // The one merge in this store: the server sends one source's snapshot at a time
    // (BAJAOVRLAY-40), so the list is the hello's, with that source's entry replaced.
    // What the server sent still wins for that source; nothing is computed here.
    mergeOneDataSnapshot: (message) => {
      set((state) => ({
        dataSnapshots: mergeDataSnapshotIntoList(
          state.dataSnapshots,
          message.sourceId,
          message.snapshot,
        ),
      }));
    },

    changeConnectionStatus: (connectionStatus) => {
      set({ connectionStatus });
    },
    noteServerClockOffRealTime: (offFromRealTimeMs) => {
      const secondsOff = countSecondsWorthAWarning(offFromRealTimeMs);
      // Only a change is set: a `time` message comes every ten seconds, and the header
      // must not redraw each time for the same number.
      set((state) =>
        state.serverClockSecondsOffRealTime === secondsOff
          ? state
          : { serverClockSecondsOffRealTime: secondsOff },
      );
    },
    rememberCommandError: (commandError) => {
      set({ lastCommandError: commandError });
    },
    forgetCommandError: () => {
      set({ lastCommandError: null });
    },
  }));
}

/** From this far off real time on, the header warns about the server clock. */
const serverClockOffWorthAWarningMs = 2_000;

/** Whole seconds off real time, when 2 s or more; null otherwise, or when unknown. */
function countSecondsWorthAWarning(offFromRealTimeMs: number | undefined): number | null {
  if (offFromRealTimeMs === undefined) {
    return null;
  }
  if (Math.abs(offFromRealTimeMs) < serverClockOffWorthAWarningMs) {
    return null;
  }
  return Math.round(offFromRealTimeMs / 1000);
}

/**
 * The list with one source's snapshot put in: in its place when the source has one,
 * at the end when it is new, or taken out when the snapshot is null. A null for a source
 * the list does not have hands back the very same list, so nothing redraws.
 */
function mergeDataSnapshotIntoList(
  snapshots: DataSnapshot[],
  sourceId: string,
  snapshot: DataSnapshot | null,
): DataSnapshot[] {
  const hasThisSource = snapshots.some((candidate) => candidate.sourceId === sourceId);
  if (snapshot === null) {
    if (!hasThisSource) {
      return snapshots;
    }
    return snapshots.filter((candidate) => candidate.sourceId !== sourceId);
  }
  if (!hasThisSource) {
    return [...snapshots, snapshot];
  }
  return snapshots.map((candidate) => (candidate.sourceId === sourceId ? snapshot : candidate));
}

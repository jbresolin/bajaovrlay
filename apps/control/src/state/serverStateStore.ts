import {
  type ChangedSlices,
  type DataSnapshot,
  type DataSnapshotMessage,
  mergeChangedSlicesIntoSlices,
  type SliceMessage,
  type Slices,
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
 * plus two facts about the page itself (connection status, last failed command). The
 * functions are the only ways to change it, and only serverConnection.ts calls them.
 */
export type ServerState = Slices & {
  connectionStatus: ConnectionStatus;
  lastCommandError: LastCommandError | null;
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
    layers: [],
    graphics: [],
    instances: [],
    previewClearedLayerIds: [],
    instanceBindings: [],
    rundowns: [],
    items: [],
    quickFirePanels: [],
    macros: [],
    macroRuns: [],
    dataSources: [],
    dataSnapshots: [],
    overrides: [],
    recordings: [],
    events: [],
    eventRules: [],
    eventLog: [],
    connectionStatus: 'connecting',
    lastCommandError: null,

    replaceEverySlice: (slices) => {
      set({
        layers: slices.layers,
        graphics: slices.graphics,
        instances: slices.instances,
        previewClearedLayerIds: slices.previewClearedLayerIds,
        instanceBindings: slices.instanceBindings,
        rundowns: slices.rundowns,
        items: slices.items,
        quickFirePanels: slices.quickFirePanels,
        macros: slices.macros,
        macroRuns: slices.macroRuns,
        dataSources: slices.dataSources,
        dataSnapshots: slices.dataSnapshots,
        overrides: slices.overrides,
        recordings: slices.recordings,
        events: slices.events,
        eventRules: slices.eventRules,
        eventLog: slices.eventLog,
      });
    },

    // One case per slice name, written out, so the compiler checks that each name
    // stores the kind of list that belongs to it. A slice is never merged: what the
    // server sent replaces what was there, because the server owns the truth.
    replaceOneSlice: (message) => {
      switch (message.name) {
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
        case 'dataSources':
          set({ dataSources: message.slice });
          break;
        case 'overrides':
          set({ overrides: message.slice });
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
        case 'eventLog':
          set({ eventLog: message.slice });
          break;
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
    rememberCommandError: (commandError) => {
      set({ lastCommandError: commandError });
    },
    forgetCommandError: () => {
      set({ lastCommandError: null });
    },
  }));
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

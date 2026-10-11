import type { SliceMessage, Slices } from '@bajaovrlay/shared';
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
    rundowns: [],
    items: [],
    eventLog: [],
    connectionStatus: 'connecting',
    lastCommandError: null,

    replaceEverySlice: (slices) => {
      set({
        layers: slices.layers,
        graphics: slices.graphics,
        instances: slices.instances,
        rundowns: slices.rundowns,
        items: slices.items,
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
        case 'rundowns':
          set({ rundowns: message.slice });
          break;
        case 'items':
          set({ items: message.slice });
          break;
        case 'eventLog':
          set({ eventLog: message.slice });
          break;
      }
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

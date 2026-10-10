import type { CommandInput } from '@bajaovrlay/shared';
import { createContext, type ReactNode, useContext } from 'react';
import { useStore } from 'zustand';

import type { SendCommand } from './serverConnection';
import type { ServerState, ServerStateStore } from './serverStateStore';

/** What every component under the provider can reach: the store and the way to send. */
type ControlPageState = {
  serverStateStore: ServerStateStore;
  sendCommand: SendCommand;
};

const ControlPageStateContext = createContext<ControlPageState | null>(null);

/**
 * Makes the store and `sendCommand` available to every component below it. main.tsx
 * wraps the page in it once, with the real connection; tests wrap a component in it
 * with a connection to a fake server.
 */
export function ControlPageStateProvider(props: {
  serverStateStore: ServerStateStore;
  sendCommand: SendCommand;
  children: ReactNode;
}) {
  const controlPageState: ControlPageState = {
    serverStateStore: props.serverStateStore,
    sendCommand: props.sendCommand,
  };
  return (
    <ControlPageStateContext.Provider value={controlPageState}>
      {props.children}
    </ControlPageStateContext.Provider>
  );
}

function useControlPageState(): ControlPageState {
  const controlPageState = useContext(ControlPageStateContext);
  if (controlPageState === null) {
    throw new Error('This component must be drawn inside <ControlPageStateProvider>.');
  }
  return controlPageState;
}

/**
 * Reads one piece of server state and redraws the component when that piece changes:
 * `useServerState((state) => state.layers)`. The selector must return something the
 * store already holds (a slice, a status), not a list built on the spot, or the
 * component would redraw on every change anywhere in the store.
 */
export function useServerState<SelectedPiece>(
  selectPiece: (state: ServerState) => SelectedPiece,
): SelectedPiece {
  const { serverStateStore } = useControlPageState();
  return useStore(serverStateStore, selectPiece);
}

/**
 * Returns a function that reads the server state as it is at the moment of the call,
 * without redrawing anything. For code that runs after waiting for the server (a button
 * handler past its `await`), where the state the component drew with is already old.
 * To draw something, use `useServerState`.
 */
export function useReadServerStateNow(): () => ServerState {
  const { serverStateStore } = useControlPageState();
  return serverStateStore.getState;
}

/** Whether the page can send commands right now (it holds a hello from the server). */
export function useIsConnectedToServer(): boolean {
  return useServerState((state) => state.connectionStatus === 'connected');
}

/**
 * Returns the function buttons use to send a command. It resolves to whether the server
 * accepted it and never rejects: a failure is already in the store's
 * `lastCommandError`, where the page shows it, so a button has nothing left to handle.
 */
export function useSendCommand(): (command: CommandInput) => Promise<boolean> {
  const { sendCommand } = useControlPageState();
  return async (command) => {
    try {
      await sendCommand(command);
      return true;
    } catch {
      return false;
    }
  };
}

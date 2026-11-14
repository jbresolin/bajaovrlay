import type { CommandInput } from '@bajaovrlay/shared';
import { createContext, type ReactNode, useContext } from 'react';
import { useStore } from 'zustand';

import { type AreaOfThePage, CommandFailedError } from './commandFailure';
import type { CommandResult, SendCommand } from './serverConnection';
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

/**
 * Returns a function that calls `onStateChanged` after every change of the server state,
 * and returns the way to stop. For a value computed from several slices that a component
 * reads with React's useSyncExternalStore, so it redraws only when that value changes (the
 * item editor's "Valor agora", BAJAOVRLAY-45). To draw a slice, use `useServerState`.
 */
export function useSubscribeToServerState(): (onStateChanged: () => void) => () => void {
  const { serverStateStore } = useControlPageState();
  return serverStateStore.subscribe;
}

/** Whether the page can send commands right now (it holds a hello from the server). */
export function useIsConnectedToServer(): boolean {
  return useServerState((state) => state.connectionStatus === 'connected');
}

/**
 * Returns a function that sends a command and resolves to the server's ok answer, or to
 * null when the command was not accepted (refused, unanswered, no connection). For a
 * press that needs what the answer says: the item editor's "Salvar e disparar" reads the
 * id of the item a createItem made. It never rejects, for the reason useSendCommand
 * gives below.
 */
export function useSendCommandAndReadItsAnswer(): (
  command: CommandInput,
) => Promise<CommandResult | null> {
  const { sendCommand } = useControlPageState();
  return async (command) => {
    try {
      return await sendCommand(command);
    } catch {
      return null;
    }
  };
}

/**
 * Returns the function buttons use to send a command. It resolves to whether the server
 * accepted it and never rejects: a failure is already in the store's
 * `lastCommandError`, where the page shows it, so a button has nothing left to handle.
 * `areaOfThePage` names the part of the page the button is in, when another part sends
 * the same type, so the refusal shows there only (CommandErrorMessage).
 */
export function useSendCommand(): (
  command: CommandInput,
  areaOfThePage?: AreaOfThePage,
) => Promise<boolean> {
  const { sendCommand } = useControlPageState();
  return async (command, areaOfThePage) => {
    try {
      await sendCommand(command, areaOfThePage);
      return true;
    } catch {
      return false;
    }
  };
}

/**
 * Returns a function that sends a command and resolves to the operator's sentence for its
 * refusal, or to null when the server accepted it. For a dialog that shows the refusal of
 * its own command beside its buttons, rather than the page's last refusal of that kind
 * (the correction dialog, gate 2 of PR #18). It never rejects.
 */
export function useSendCommandAndReadItsRefusal(): (
  command: CommandInput,
) => Promise<string | null> {
  const { sendCommand } = useControlPageState();
  return async (command) => {
    try {
      await sendCommand(command);
      return null;
    } catch (failure) {
      return failure instanceof CommandFailedError ? failure.message : String(failure);
    }
  };
}

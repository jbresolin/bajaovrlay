// Test support: draws a piece of the control page wired exactly as in the browser (the
// real store and the real connection code) but talking to a fake server the test drives.
// Component tests use it so a button press travels the same road as on a race weekend.
import type { CommandError, ServerMessage, Slices } from '@bajaovrlay/shared';
import { act, fireEvent, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';

import { ControlPageStateProvider } from './ControlPageStateProvider';
import { createFakeServerSocket } from './fakeServerSocket.testSupport';
import { connectToServer } from './serverConnection';
import { createServerStateStore, type ServerStateStore } from './serverStateStore';

/** What a component test gets back: the store, and the fake server to play with. */
export type ControlPageOnFakeServer = {
  serverStateStore: ServerStateStore;
  fakeServer: {
    /** Every command the page has sent, oldest first (the command only, no envelope). */
    listCommandsReceived: () => unknown[];
    /** The server answers the newest command with `ok: true`. */
    acceptLastCommand: () => void;
    /** The server answers the newest command with `ok: false` and this error. */
    refuseLastCommand: (error: CommandError) => void;
    /** The server sends one protocol message, for example a changed slice. */
    sendMessage: (message: ServerMessage) => void;
    /** The line drops, as when the server restarts or the network cable is pulled. */
    dropConnection: () => void;
  };
};

/**
 * Draws `pageContent` on a control page whose connection is up and which has already
 * received `slices` in the server's hello.
 */
export function renderOnControlPageConnectedToFakeServer(
  pageContent: ReactElement,
  slices: Slices,
): ControlPageOnFakeServer {
  const controlPage = renderOnControlPageStillWaitingForTheServer(pageContent);
  controlPage.fakeServer.sendMessage({ type: 'hello', slices });
  return controlPage;
}

/**
 * Draws `pageContent` on a control page that has dialled the server but has not heard
 * from it yet: the state an operator sees when the page opens before the server is up.
 */
export function renderOnControlPageStillWaitingForTheServer(
  pageContent: ReactElement,
): ControlPageOnFakeServer {
  const serverStateStore = createServerStateStore();
  const fakeServerSocket = createFakeServerSocket();
  const serverConnection = connectToServer({
    webSocketAddress: 'ws://localhost:5173/ws',
    serverStateStore,
    openSocket: fakeServerSocket.openSocket,
    // Log lines are checked in serverConnection.test.ts; here they would only be noise.
    logEvent: () => undefined,
  });
  fakeServerSocket.acceptConnection();

  render(
    <ControlPageStateProvider
      serverStateStore={serverStateStore}
      sendCommand={serverConnection.sendCommand}
    >
      {pageContent}
    </ControlPageStateProvider>,
  );

  // `act` tells React "something outside the page just changed; redraw before the test
  // goes on". Every step the fake server takes is wrapped in it, so tests need not be.
  return {
    serverStateStore,
    fakeServer: {
      listCommandsReceived: () =>
        fakeServerSocket.listCommandMessagesReceived().map((message) => message.command),
      acceptLastCommand: () => act(() => fakeServerSocket.acceptLastCommand()),
      refuseLastCommand: (error) => act(() => fakeServerSocket.refuseLastCommand(error)),
      sendMessage: (message) => act(() => fakeServerSocket.sendMessage(message)),
      dropConnection: () => act(() => fakeServerSocket.dropConnection()),
    },
  };
}

/**
 * Moves the page's clock forward. Only for tests that called `vi.useFakeTimers()`: there
 * time stands still until the test moves it, so "3 seconds later" takes no real time.
 */
export function letTimePassOnThePage(milliseconds: number): void {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

/**
 * Makes a disabled button show its tooltip, as it does when the operator rests the
 * mouse on it or reaches it with the Tab key. A disabled button cannot be focused
 * itself, so the page wraps it in a small focusable area; that area is what gets focus.
 */
export function focusAreaAroundDisabledButton(disabledButton: HTMLElement): void {
  const focusableAreaAroundTheButton = disabledButton.parentElement;
  if (focusableAreaAroundTheButton === null) {
    throw new Error('the disabled button is not on the page');
  }
  fireEvent.focus(focusableAreaAroundTheButton);
}

/**
 * The renderer's connection to the server: a WebSocket to `/ws` that is kept open for as
 * long as the page lives. Every message is checked against the shared protocol before it
 * is believed. The renderer only listens; it sends no commands in M0.
 *
 * What the renderer gets out of it is a stream of deliveries: all the slices, either as a
 * full snapshot (after a `hello`, which is the whole truth and makes the renderer rebuild
 * the stage) or with one slice replaced (after a `slice` message).
 */
import {
  type ServerMessage,
  ServerMessageSchema,
  type Slices,
  SlicesSchema,
} from '@bajaovrlay/shared';

import { logRendererEvent } from './rendererLog.js';

// Reconnect waits: 0.5 s after the first drop, doubling up to 5 s. Short at first because
// a server restart takes about a second; capped so a long outage is retried steadily.
const firstReconnectWaitInMilliseconds = 500;
const longestReconnectWaitInMilliseconds = 5000;

// The server sends `hello` right after the socket opens. If it has not arrived by then,
// the state is read over HTTP instead, so the stage is never left waiting on a quiet socket.
const helloWaitLimitInMilliseconds = 3000;

/** Every slice, and whether they are the whole truth (rebuild) or one slice changed. */
export type SlicesDelivery = {
  slices: Slices;
  isFullSnapshot: boolean;
};

/**
 * The few things the connection needs from a WebSocket. Narrower than the browser's
 * WebSocket on purpose, so a test can stand in for the server with a plain object.
 */
export type ServerSocket = {
  onOpen: (listener: () => void) => void;
  onMessage: (listener: (data: unknown) => void) => void;
  onClose: (listener: () => void) => void;
  close: () => void;
};

/** Where to connect, and (for tests) stand-ins for the socket, the HTTP read and the log. */
export type ServerConnectionOptions = {
  /** For example `ws://192.168.0.10:3000/ws`. */
  webSocketAddress: string;
  /** For example `http://192.168.0.10:3000/api/v1/state`. */
  stateAddress: string;
  openSocket?: (address: string) => ServerSocket;
  fetchJson?: (address: string) => Promise<unknown>;
  logEvent?: typeof logRendererEvent;
};

/** A running connection. It never ends; the page is closed instead. */
export type ServerConnection = {
  /** Registers who receives the slices. Call it right after connecting. */
  onSlices: (callback: (delivery: SlicesDelivery) => void) => void;
};

/** Opens the browser's own WebSocket and exposes it as a ServerSocket. */
function openBrowserWebSocket(address: string): ServerSocket {
  const webSocket = new WebSocket(address);
  return {
    onOpen: (listener) => webSocket.addEventListener('open', () => listener()),
    onMessage: (listener) =>
      webSocket.addEventListener('message', (event: MessageEvent<unknown>) => listener(event.data)),
    onClose: (listener) => webSocket.addEventListener('close', () => listener()),
    close: () => webSocket.close(),
  };
}

/** Reads a JSON body over HTTP; rejects on a network failure or a non-2xx answer. */
async function fetchJsonOverHttp(address: string): Promise<unknown> {
  const response = await fetch(address);
  if (!response.ok) {
    throw new Error(`GET ${address} answered ${response.status}`);
  }
  return response.json();
}

/**
 * Connects to the server and keeps reconnecting for as long as the page lives. Returns
 * at once; the slices arrive later through `onSlices`.
 */
export function connectToServer(options: ServerConnectionOptions): ServerConnection {
  const openSocket = options.openSocket ?? openBrowserWebSocket;
  const fetchJson = options.fetchJson ?? fetchJsonOverHttp;
  const logEvent = options.logEvent ?? logRendererEvent;

  const slicesCallbacks: Array<(delivery: SlicesDelivery) => void> = [];
  // The slices as the server last described them. Not state of the renderer's own: it is
  // only kept so a `slice` message (one slice) can be delivered together with the rest.
  let slicesFromServer: Slices | undefined = undefined;
  let nextReconnectWaitInMilliseconds = firstReconnectWaitInMilliseconds;

  function deliverFullSnapshot(slices: Slices): void {
    slicesFromServer = slices;
    // A full snapshot proves the server is healthy, so the next drop starts with a short wait.
    nextReconnectWaitInMilliseconds = firstReconnectWaitInMilliseconds;
    slicesCallbacks.forEach((callback) => callback({ slices, isFullSnapshot: true }));
  }

  function handleMessage(data: unknown): 'hello' | 'other' {
    const message = parseServerMessage(data);
    if (message === undefined) {
      logEvent('warn', 'server message ignored: not in the protocol');
      return 'other';
    }
    if (message.type === 'hello') {
      deliverFullSnapshot(message.slices);
      return 'hello';
    }
    if (message.type === 'slice') {
      if (slicesFromServer === undefined) {
        logEvent('warn', 'slice message ignored: no full snapshot received yet', {
          sliceName: message.name,
        });
        return 'other';
      }
      const slices: Slices = { ...slicesFromServer, [message.name]: message.slice };
      slicesFromServer = slices;
      slicesCallbacks.forEach((callback) => callback({ slices, isFullSnapshot: false }));
      return 'other';
    }
    // A commandResult: the renderer sends no commands, so there is nothing to do with it.
    return 'other';
  }

  function openOneSocket(): void {
    const socket = openSocket(options.webSocketAddress);
    let hasReceivedHello = false;
    let isClosed = false;
    let helloWaitTimer: ReturnType<typeof setTimeout> | undefined = undefined;

    /** The hello is late: read the state over HTTP; if that fails too, start over. */
    async function readStateBecauseHelloIsLate(): Promise<void> {
      logEvent('warn', 'no hello within 3 s; reading the state over HTTP');
      let slices: Slices;
      try {
        slices = SlicesSchema.parse(await fetchJson(options.stateAddress));
      } catch (readError) {
        if (isClosed || hasReceivedHello) {
          return;
        }
        logEvent('error', 'state read over HTTP failed; reconnecting', {
          reason: String(readError),
        });
        // Closing fires the close listener below, which schedules the reconnect.
        socket.close();
        return;
      }
      // A hello that arrived while the read was under way is newer; a socket that
      // closed meanwhile will get its own hello after reconnecting.
      if (isClosed || hasReceivedHello) {
        return;
      }
      deliverFullSnapshot(slices);
    }

    socket.onOpen(() => {
      logEvent('info', 'connected to the server', { address: options.webSocketAddress });
      helloWaitTimer = setTimeout(() => {
        void readStateBecauseHelloIsLate();
      }, helloWaitLimitInMilliseconds);
    });

    socket.onMessage((data) => {
      if (handleMessage(data) === 'hello') {
        hasReceivedHello = true;
        clearTimeout(helloWaitTimer);
      }
    });

    socket.onClose(() => {
      isClosed = true;
      clearTimeout(helloWaitTimer);
      const waitInMilliseconds = nextReconnectWaitInMilliseconds;
      nextReconnectWaitInMilliseconds = Math.min(
        waitInMilliseconds * 2,
        longestReconnectWaitInMilliseconds,
      );
      // Nothing on the stage is touched here: what is on air stays on air until the
      // server says otherwise in its next hello.
      logEvent('warn', 'connection to the server lost; reconnecting', { waitInMilliseconds });
      setTimeout(openOneSocket, waitInMilliseconds);
    });
  }

  openOneSocket();

  return {
    onSlices: (callback) => {
      slicesCallbacks.push(callback);
    },
  };
}

/** Reads one WebSocket message; undefined when it is not text, not JSON or not in the protocol. */
function parseServerMessage(data: unknown): ServerMessage | undefined {
  if (typeof data !== 'string') {
    return undefined;
  }
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return undefined;
  }
  const parsed = ServerMessageSchema.safeParse(json);
  if (!parsed.success) {
    return undefined;
  }
  return parsed.data;
}

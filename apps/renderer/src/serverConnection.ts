/**
 * The renderer's connection to the server: a WebSocket to `/ws?role=renderer`
 * (`/ws?role=monitor` for a monitor or a preview page, see rendererPageRole.ts) that is
 * kept open for as long as the page lives. Every message is checked against the shared
 * protocol before it is believed.
 *
 * What the renderer gets out of it is a stream of deliveries: all the slices, either as a
 * full snapshot (after a `hello`, which is the whole truth and makes the renderer rebuild
 * the stage), with one slice replaced (after a `slice` message) or with several replaced
 * at once (after a `slices` message: one state change, one delivery).
 *
 * What the renderer says over it is one kind of message, `instanceStatus`: what really
 * happened on screen to an instance. It sends no commands.
 *
 * It also learns the server's clock here: every `hello`, `slice` and `slices` message, and the
 * `time` message the server sends every ten seconds, says what the server's clock showed
 * (`serverNowMs`), and each is recorded as one sample for the shared "now" the graphics
 * read (@bajaovrlay/shared/clock). A program monitor does the same, since it runs this
 * very code.
 *
 * And it learns the server's build: a `hello` naming another build than the one this page
 * was loaded from reloads the page, at most once per announced build
 * (packages/shared/src/build), so an OBS browser source left open across an upgrade does
 * not go on with the old bundle, and one loaded between a build and the restart is not
 * blanked again and again. The build is read even from a hello this page's own schema
 * refuses (a newer server's slices). Only when sessionStorage cannot keep the announced
 * build is it once a minute, a reload skipped as too recent tried again after the minute.
 */
import {
  type InstanceStatusMessage,
  mergeChangedSlicesIntoSlices,
  type PageReloadForNewBuild,
  readBuildIdOfAHello,
  type ServerBuildWatch,
  type ServerMessage,
  ServerMessageSchema,
  type Slices,
  SlicesSchema,
  startServerBuildWatch,
} from '@bajaovrlay/shared';
import { recordServerClockSample } from '@bajaovrlay/shared/clock';

import { logRendererEvent } from './rendererLog.js';

// Reconnect waits: 0.5 s after the first drop, doubling up to 5 s. Short at first because
// a server restart takes about a second; capped so a long outage is retried steadily.
const firstReconnectWaitInMilliseconds = 500;
const longestReconnectWaitInMilliseconds = 5000;

// The server sends `hello` right after the socket opens. If it has not arrived by then,
// the state is read over HTTP instead, so the stage is never left waiting on a quiet socket.
const helloWaitLimitInMilliseconds = 3000;

/** Every slice, and whether they are the whole truth (rebuild) or some slices changed. */
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
  /** Sends one text. Only called between the socket's open and its close. */
  send: (text: string) => void;
  close: () => void;
};

/** Where to connect, and (for tests) stand-ins for the socket, the HTTP read and the log. */
export type ServerConnectionOptions = {
  /** For example `ws://192.168.0.10:3000/ws?role=renderer`. */
  webSocketAddress: string;
  /** For example `http://192.168.0.10:3000/api/v1/state?role=renderer`. */
  stateAddress: string;
  openSocket?: (address: string) => ServerSocket;
  fetchJson?: (address: string) => Promise<unknown>;
  logEvent?: typeof logRendererEvent;
  /**
   * The page's build and the browser's clock, reload and sessionStorage, for reloading the
   * page when a hello names another build (renderer.ts hands in
   * browserPageReloadForNewBuild). Left out (most tests), no build is compared.
   */
  pageReloadForNewBuild?: PageReloadForNewBuild | undefined;
};

/** A running connection. It never ends; the page is closed instead. */
export type ServerConnection = {
  /** Registers who receives the slices. Call it right after connecting. */
  onSlices: (callback: (delivery: SlicesDelivery) => void) => void;
  /**
   * Tells the server what happened on screen to one instance. Sent at once when the
   * socket is open; otherwise logged and dropped, never kept for later.
   */
  sendInstanceStatus: (statusReport: InstanceStatusMessage) => void;
};

/** Opens the browser's own WebSocket and exposes it as a ServerSocket. */
function openBrowserWebSocket(address: string): ServerSocket {
  const webSocket = new WebSocket(address);
  return {
    onOpen: (listener) => webSocket.addEventListener('open', () => listener()),
    onMessage: (listener) =>
      webSocket.addEventListener('message', (event: MessageEvent<unknown>) => listener(event.data)),
    onClose: (listener) => webSocket.addEventListener('close', () => listener()),
    send: (text) => webSocket.send(text),
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
  // only kept so a `slice` or `slices` message can be delivered together with the rest.
  let slicesFromServer: Slices | undefined = undefined;
  let nextReconnectWaitInMilliseconds = firstReconnectWaitInMilliseconds;
  // The socket that is open right now, if there is one: set when a socket opens and
  // emptied when it closes. It is the only socket anything may be sent on.
  let socketThatIsOpen: ServerSocket | undefined = undefined;
  // Compares the build of each hello with the page's (packages/shared/src/build); none
  // when the page brought no build stand-ins (most tests).
  const serverBuildWatch = startWatchOnTheServerBuild(options.pageReloadForNewBuild, logEvent);

  function sendInstanceStatus(statusReport: InstanceStatusMessage): void {
    if (socketThatIsOpen === undefined) {
      // Not kept for later, on purpose: after the reconnect the server's hello makes the
      // renderer rebuild the stage, and the rebuild reports every instance afresh. A
      // report kept from before the drop could by then be about an instance that is gone.
      logEvent('warn', 'instance status not sent: no open connection to the server', {
        instanceId: statusReport.instanceId,
        status: statusReport.status,
      });
      return;
    }
    socketThatIsOpen.send(JSON.stringify(statusReport));
  }

  function deliverFullSnapshot(slices: Slices): void {
    slicesFromServer = slices;
    // A full snapshot proves the server is healthy, so the next drop starts with a short wait.
    nextReconnectWaitInMilliseconds = firstReconnectWaitInMilliseconds;
    slicesCallbacks.forEach((callback) => callback({ slices, isFullSnapshot: true }));
  }

  /** Remembers the slices after a `slice` or `slices` message and delivers them, not as a rebuild. */
  function deliverChangedSlices(slices: Slices): void {
    slicesFromServer = slices;
    slicesCallbacks.forEach((callback) => callback({ slices, isFullSnapshot: false }));
  }

  /** Acts on one message, and tells the socket whether it was the hello it waits for. */
  function handleMessage(data: unknown): { wasHello: boolean } {
    // Read first, before the message is even parsed: checking a large hello takes a few
    // milliseconds, and each of them would make the sample of the server's clock later.
    const localTimeAtArrivalMs = Date.now();
    const messageJson = readJsonOfMessage(data);
    const message = parseServerMessage(messageJson);
    if (message === undefined) {
      logEvent('warn', 'server message ignored: not in the protocol');
      // A hello this page's schema refuses is the case the build check exists for: a
      // newer server's slices that this bundle does not know. Its build is read on its own.
      const buildIdOfARefusedHello = readBuildIdOfAHello(messageJson);
      if (buildIdOfARefusedHello !== undefined) {
        serverBuildWatch?.compareWithTheServerBuild(buildIdOfARefusedHello);
      }
      return { wasHello: false };
    }
    recordServerClockSampleOfMessage(message, localTimeAtArrivalMs);
    if (message.type === 'hello') {
      // Drawn first: a page that does not reload (same build, or already reloaded for this
      // one) goes on as always, and one that reloads rebuilds the same stage.
      deliverFullSnapshot(message.slices);
      serverBuildWatch?.compareWithTheServerBuild(message.buildId);
      return { wasHello: true };
    }
    if (message.type === 'slice') {
      if (slicesFromServer === undefined) {
        logEvent('warn', 'slice message ignored: no full snapshot received yet', {
          sliceName: message.name,
        });
        return { wasHello: false };
      }
      deliverChangedSlices({ ...slicesFromServer, [message.name]: message.slice });
      return { wasHello: false };
    }
    if (message.type === 'slices') {
      if (slicesFromServer === undefined) {
        logEvent('warn', 'slices message ignored: no full snapshot received yet', {
          sliceNames: Object.keys(message.slices),
        });
        return { wasHello: false };
      }
      // Every slice of the group in ONE delivery: the reconciler must never see some of
      // them new and the others old. "Prévia: limpar" on a previewed layer delivered one
      // at a time showed the program clock on the preview page for a moment.
      deliverChangedSlices(mergeChangedSlicesIntoSlices(slicesFromServer, message.slices));
      return { wasHello: false };
    }
    if (message.type === 'time') {
      // The server's ten-second time message. Its sample was recorded just above, and
      // that is all there is to do with it: nothing on the stage changes, and a log
      // line every ten seconds would bury the lines that matter in the OBS console.
      return { wasHello: false };
    }
    if (message.type === 'dataSnapshot') {
      // One source's raw data, which the server sends operator connections only: graphics
      // receive resolved data (rule 3). A renderer that got one anyway draws nothing new
      // from it, so it is dropped without a log line.
      return { wasHello: false };
    }
    // A commandResult. The renderer never waits for one, but the server may answer an
    // instanceStatus with it. An ok needs nothing (a late report about an
    // instance already cleared is answered ok too). A refusal (this connection is not
    // counted as a renderer) changes nothing here either, yet it is written down: the OBS
    // console is the only place it could be read.
    if (!message.ok) {
      // `serverMessage`, because `message` is already the key of the log line's own text.
      logEvent('warn', 'server refused a message from the renderer', {
        code: message.error.code,
        serverMessage: message.error.message,
      });
    }
    return { wasHello: false };
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
      socketThatIsOpen = socket;
      logEvent('info', 'connected to the server', { address: options.webSocketAddress });
      helloWaitTimer = setTimeout(() => {
        void readStateBecauseHelloIsLate();
      }, helloWaitLimitInMilliseconds);
    });

    socket.onMessage((data) => {
      const { wasHello } = handleMessage(data);
      if (wasHello) {
        hasReceivedHello = true;
        clearTimeout(helloWaitTimer);
      }
    });

    socket.onClose(() => {
      isClosed = true;
      // Checked, so that a close reported late by an old socket could never empty the
      // slot of a newer one that has opened meanwhile.
      if (socketThatIsOpen === socket) {
        socketThatIsOpen = undefined;
      }
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
    sendInstanceStatus,
  };
}

/**
 * Starts the watch on the server's build with the browser's setTimeout, or none when the
 * page brought no build stand-ins. The watch logs through the renderer's log.
 */
function startWatchOnTheServerBuild(
  pageReloadForNewBuild: PageReloadForNewBuild | undefined,
  logEvent: typeof logRendererEvent,
): ServerBuildWatch | undefined {
  if (pageReloadForNewBuild === undefined) {
    return undefined;
  }
  return startServerBuildWatch({
    pageReload: pageReloadForNewBuild,
    logBuildEvent: logEvent,
    startTimer: (callback, waitInMilliseconds) => {
      const timer = setTimeout(callback, waitInMilliseconds);
      return () => clearTimeout(timer);
    },
  });
}

/**
 * Records what a `hello`, `slice`, `slices` or `time` message says the server's clock showed, as
 * one sample for the shared "now" the graphics read. A `commandResult` carries no clock,
 * and neither does a hello or slice from a stand-in server that leaves `serverNowMs`
 * out. Such a message records NOTHING: it is "no sample", never a sample saying the two
 * clocks agree, which would pull a correction already learned back towards zero.
 * What could go wrong: the message spent some time on the network, so every sample is
 * late by that much and the clock on air runs that much behind the server's (a few
 * milliseconds on a local network). One message held up for longer is left aside by the
 * median of the last five samples. The state read over HTTP when a hello is late gives
 * no sample: GET /api/v1/state answers the slices alone. A step of this machine's clock
 * is corrected by the `time` messages, which come every ten seconds even when no slice
 * changes; the median needs three of them, so the clock on air is wrong for about
 * thirty seconds after such a step.
 */
function recordServerClockSampleOfMessage(
  message: ServerMessage,
  localTimeAtArrivalMs: number,
): void {
  if (message.type === 'commandResult') {
    return;
  }
  if (message.serverNowMs === undefined) {
    return;
  }
  recordServerClockSample(message.serverNowMs, localTimeAtArrivalMs);
}

/** Reads the JSON of one WebSocket message; undefined when it is not text or not JSON. */
function readJsonOfMessage(data: unknown): unknown {
  if (typeof data !== 'string') {
    return undefined;
  }
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

/** Checks the JSON of one message against the protocol; undefined when it is not in it. */
function parseServerMessage(json: unknown): ServerMessage | undefined {
  const parsed = ServerMessageSchema.safeParse(json);
  if (!parsed.success) {
    return undefined;
  }
  return parsed.data;
}

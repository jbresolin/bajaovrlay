// Test support: a fake OBS 32, as far as BajaOvrLay talks to it. A real `ws` server on a
// free port of 127.0.0.1 speaking obs-websocket v5 in JSON (subprotocol
// `obswebsocket.json`): Hello, Identify with the password's challenge, Identified, the
// four requests the server sends, and the scene events OBS sends when someone works it by
// hand. Written from the protocol, not from the client library, so the server's real
// client is what the tests exercise; no client is ever mocked.
//
// Its OBS has scenes in the order of its Scenes panel (top first), a scene on Program,
// and Studio Mode with a scene on Preview. A test works it "by hand" (switch, rename, add,
// Studio Mode) and the fake sends the events real OBS sends, only to clients that
// subscribed to their category, as real OBS does. It can also close as OBS does when it
// quits: every connection drops, and attempts are refused, and counted, until it opens
// again on the same port.
import { createHash, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { onTestFinished } from 'vitest';
import { type WebSocket, WebSocketServer } from 'ws';

// The protocol's numbers (obs-websocket 5.x, docs/generated/protocol.md).
const helloOpCode = 0;
const identifyOpCode = 1;
const identifiedOpCode = 2;
const eventOpCode = 5;
const requestOpCode = 6;
const requestResponseOpCode = 7;
const authenticationFailedCloseCode = 4009;
const scenesEventCategory = 4;
const uiEventCategory = 1024;
const requestSucceededStatusCode = 100;
const unknownRequestTypeStatusCode = 204;
const studioModeNotActiveStatusCode = 506;
const resourceNotFoundStatusCode = 600;

/** What the fake OBS starts with. */
export type FakeObsSetup = {
  /** Null: OBS's "Enable Authentication" is off. */
  password: string | null;
  /** The scenes as the Scenes panel lists them, top first. */
  sceneNames: string[];
  programSceneName: string;
  isStudioModeOn: boolean;
  /** Only read while Studio Mode is on. */
  previewSceneName: string;
};

/** One request a client sent, as the fake received it. */
export type RequestReceivedByFakeObs = { requestType: string; requestData: unknown };

/** The fake OBS a test drives, and what it saw. */
export type FakeObs = {
  /** `ws://127.0.0.1:<port>`, for BAJAOVRLAY_OBS_URL. */
  address: string;
  /** Every request received, in order. */
  readRequestsReceived: () => RequestReceivedByFakeObs[];
  /** Resolves once a request of this type was received (at once if one already was). */
  waitForRequest: (requestType: string) => Promise<void>;
  /** How many connection attempts were refused while OBS was closed. */
  countAttemptsRefusedWhileClosed: () => number;
  /** Resolves once this many attempts were refused while closed (counting from the start). */
  waitForAttemptsRefusedWhileClosed: (numberOfAttempts: number) => Promise<void>;
  /** How many clients are identified now. */
  countIdentifiedClients: () => number;
  /**
   * Resolves once no client is connected (at once if none is). A client's own hang-up
   * ends before OBS's side of the socket has closed, so a test waits for OBS's side.
   */
  waitUntilNoClientIsConnected: () => Promise<void>;
  /** Puts a scene on Program, as clicking it in OBS outside Studio Mode does. */
  switchProgramSceneByHand: (sceneName: string) => void;
  /** Lines a scene up on Preview, as clicking it in OBS in Studio Mode does. */
  switchPreviewSceneByHand: (sceneName: string) => void;
  /** Renames a scene, as OBS's "Rename" does. */
  renameSceneByHand: (oldSceneName: string, newSceneName: string) => void;
  /** Adds a scene at the top of the Scenes panel, as OBS's "+" does. */
  addSceneByHand: (sceneName: string) => void;
  /**
   * Deletes a scene and tells no one, as when it is deleted in the very moment a switch
   * to it is on its way: the server still lists it, OBS no longer has it.
   */
  removeSceneWithoutAnEvent: (sceneName: string) => void;
  /** Turns Studio Mode on (Preview then shows the Program scene) or off. */
  setStudioModeByHand: (isStudioModeOn: boolean) => void;
  /**
   * From now on, holds back the answer to every scene switch, as an OBS frozen by a heavy
   * scene would; the switch is still made.
   */
  stopAnsweringSceneSwitches: () => void;
  /** OBS quits: every connection drops and new attempts are refused until reopen(). */
  close: () => void;
  /** OBS is started again, on the same port, with the same scenes. */
  reopen: () => void;
};

/** One connected client and what it is allowed to hear. */
type FakeObsClient = { socket: WebSocket; isIdentified: boolean; eventSubscriptions: number };

/**
 * Starts a fake OBS with the given setup on a free port; it is closed for good when the
 * test ends. Every call builds its own server and its own scenes.
 */
export async function startFakeObs(setup: FakeObsSetup): Promise<FakeObs> {
  const sceneNames = [...setup.sceneNames];
  let programSceneName = setup.programSceneName;
  let previewSceneName = setup.previewSceneName;
  let isStudioModeOn = setup.isStudioModeOn;
  let isOpen = true;
  let isAnsweringSceneSwitches = true;
  let attemptsRefusedWhileClosed = 0;
  const waitsForRefusedAttempts: Array<{ numberOfAttempts: number; resolve: () => void }> = [];
  const requestsReceived: RequestReceivedByFakeObs[] = [];
  const waitsForARequest: Array<{ requestType: string; resolve: () => void }> = [];
  const clients = new Set<FakeObsClient>();
  const waitsForNoClient: Array<() => void> = [];

  const httpServer: Server = createServer();
  const webSocketServer = new WebSocketServer({
    noServer: true,
    // The client offers the one subprotocol it speaks; the fake speaks JSON only.
    handleProtocols: (offeredProtocols) =>
      offeredProtocols.has('obswebsocket.json') ? 'obswebsocket.json' : false,
  });
  httpServer.on('upgrade', (request, networkSocket, head) => {
    if (!isOpen) {
      // OBS is not running: nothing answers on its port. The attempt is counted, so a
      // test can wait for the server's next try without waiting on the clock.
      networkSocket.destroy();
      attemptsRefusedWhileClosed += 1;
      for (const wait of [...waitsForRefusedAttempts]) {
        if (attemptsRefusedWhileClosed >= wait.numberOfAttempts) {
          waitsForRefusedAttempts.splice(waitsForRefusedAttempts.indexOf(wait), 1);
          wait.resolve();
        }
      }
      return;
    }
    webSocketServer.handleUpgrade(request, networkSocket, head, (socket) => {
      greetNewClient(socket);
    });
  });
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const port = (httpServer.address() as AddressInfo).port;

  /** Sends Hello, with the password's challenge when authentication is on. */
  function greetNewClient(socket: WebSocket): void {
    const client: FakeObsClient = { socket, isIdentified: false, eventSubscriptions: 0 };
    clients.add(client);
    socket.on('close', () => {
      clients.delete(client);
      if (clients.size === 0) {
        for (const resolve of waitsForNoClient.splice(0)) {
          resolve();
        }
      }
    });
    const salt = randomBytes(16).toString('base64');
    const challenge = randomBytes(16).toString('base64');
    socket.on('message', (rawMessage) => {
      answerMessage(client, String(rawMessage), salt, challenge);
    });
    const hello = {
      obsWebSocketVersion: '5.6.3',
      rpcVersion: 1,
      ...(setup.password === null ? {} : { authentication: { challenge, salt } }),
    };
    sendMessage(socket, helloOpCode, hello);
  }

  /** Answers Identify and Request; anything else is ignored, as the fake needs no more. */
  function answerMessage(
    client: FakeObsClient,
    rawMessage: string,
    salt: string,
    challenge: string,
  ): void {
    const message = JSON.parse(rawMessage) as { op: number; d: Record<string, unknown> };
    if (message.op === identifyOpCode) {
      const expectedAuthentication =
        setup.password === null ? undefined : hashPassword(setup.password, salt, challenge);
      if (message.d.authentication !== expectedAuthentication) {
        client.socket.close(authenticationFailedCloseCode, 'Authentication failed.');
        return;
      }
      client.isIdentified = true;
      client.eventSubscriptions = Number(message.d.eventSubscriptions ?? 0);
      sendMessage(client.socket, identifiedOpCode, { negotiatedRpcVersion: 1 });
      return;
    }
    if (message.op === requestOpCode && client.isIdentified) {
      const requestType = String(message.d.requestType);
      const requestData = message.d.requestData ?? {};
      requestsReceived.push({ requestType, requestData });
      for (const wait of [...waitsForARequest]) {
        if (wait.requestType === requestType) {
          waitsForARequest.splice(waitsForARequest.indexOf(wait), 1);
          wait.resolve();
        }
      }
      answerRequest(client, String(message.d.requestId), requestType, requestData);
    }
  }

  /** Carries out one request as OBS would, and answers it. */
  function answerRequest(
    client: FakeObsClient,
    requestId: string,
    requestType: string,
    requestData: unknown,
  ): void {
    const answer = (statusCode: number, comment: string | null, responseData?: unknown) => {
      sendMessage(client.socket, requestResponseOpCode, {
        requestType,
        requestId,
        requestStatus: {
          result: statusCode === requestSucceededStatusCode,
          code: statusCode,
          ...(comment === null ? {} : { comment }),
        },
        ...(responseData === undefined ? {} : { responseData }),
      });
    };
    const sceneName = String((requestData as { sceneName?: unknown }).sceneName ?? '');
    switch (requestType) {
      case 'GetSceneList':
        answer(requestSucceededStatusCode, null, buildSceneListAnswer());
        return;
      case 'GetStudioModeEnabled':
        answer(requestSucceededStatusCode, null, { studioModeEnabled: isStudioModeOn });
        return;
      case 'SetCurrentProgramScene':
        if (!sceneNames.includes(sceneName)) {
          answer(resourceNotFoundStatusCode, `No source was found by the name of \`${sceneName}\`.`);
          return;
        }
        putSceneOnProgram(sceneName);
        if (isAnsweringSceneSwitches) {
          answer(requestSucceededStatusCode, null);
        }
        return;
      case 'SetCurrentPreviewScene':
        if (!isStudioModeOn) {
          answer(studioModeNotActiveStatusCode, 'Studio mode is not active.');
          return;
        }
        if (!sceneNames.includes(sceneName)) {
          answer(resourceNotFoundStatusCode, `No source was found by the name of \`${sceneName}\`.`);
          return;
        }
        previewSceneName = sceneName;
        sendEvent(scenesEventCategory, 'CurrentPreviewSceneChanged', { sceneName });
        if (isAnsweringSceneSwitches) {
          answer(requestSucceededStatusCode, null);
        }
        return;
      default:
        answer(unknownRequestTypeStatusCode, 'Your request type is not valid.');
    }
  }

  /**
   * GetSceneList as obs-websocket 5 answers it: the scenes bottom first, each with its
   * sceneIndex, where the top of the Scenes panel has the highest index.
   */
  function buildSceneListAnswer() {
    const scenesBottomFirst = [...sceneNames].reverse().map((name, index) => ({
      sceneIndex: index,
      sceneName: name,
      sceneUuid: `uuid-${name}`,
    }));
    return {
      currentProgramSceneName: programSceneName,
      currentProgramSceneUuid: `uuid-${programSceneName}`,
      currentPreviewSceneName: isStudioModeOn ? previewSceneName : null,
      currentPreviewSceneUuid: isStudioModeOn ? `uuid-${previewSceneName}` : null,
      scenes: scenesBottomFirst,
    };
  }

  function putSceneOnProgram(sceneName: string): void {
    programSceneName = sceneName;
    sendEvent(scenesEventCategory, 'CurrentProgramSceneChanged', { sceneName });
  }

  /** Sends one event to every identified client subscribed to its category. */
  function sendEvent(category: number, eventType: string, eventData: unknown): void {
    for (const client of clients) {
      const isSubscribed = (client.eventSubscriptions & category) !== 0;
      if (client.isIdentified && isSubscribed) {
        sendMessage(client.socket, eventOpCode, { eventType, eventIntent: category, eventData });
      }
    }
  }

  function sendSceneListChanged(): void {
    const scenes = buildSceneListAnswer().scenes;
    sendEvent(scenesEventCategory, 'SceneListChanged', { scenes });
  }

  function closeEveryConnection(): void {
    for (const client of clients) {
      client.socket.terminate();
    }
    clients.clear();
  }

  onTestFinished(async () => {
    closeEveryConnection();
    webSocketServer.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  return {
    address: `ws://127.0.0.1:${port}`,
    readRequestsReceived: () => [...requestsReceived],
    waitForRequest: (requestType) => {
      if (requestsReceived.some((request) => request.requestType === requestType)) {
        return Promise.resolve();
      }
      return new Promise((resolve) => waitsForARequest.push({ requestType, resolve }));
    },
    countAttemptsRefusedWhileClosed: () => attemptsRefusedWhileClosed,
    waitForAttemptsRefusedWhileClosed: (numberOfAttempts) => {
      if (attemptsRefusedWhileClosed >= numberOfAttempts) {
        return Promise.resolve();
      }
      return new Promise((resolve) => waitsForRefusedAttempts.push({ numberOfAttempts, resolve }));
    },
    countIdentifiedClients: () => [...clients].filter((client) => client.isIdentified).length,
    waitUntilNoClientIsConnected: () => {
      if (clients.size === 0) {
        return Promise.resolve();
      }
      return new Promise((resolve) => waitsForNoClient.push(resolve));
    },
    switchProgramSceneByHand: putSceneOnProgram,
    switchPreviewSceneByHand: (sceneName) => {
      previewSceneName = sceneName;
      sendEvent(scenesEventCategory, 'CurrentPreviewSceneChanged', { sceneName });
    },
    renameSceneByHand: (oldSceneName, newSceneName) => {
      sceneNames[sceneNames.indexOf(oldSceneName)] = newSceneName;
      if (programSceneName === oldSceneName) {
        programSceneName = newSceneName;
      }
      if (previewSceneName === oldSceneName) {
        previewSceneName = newSceneName;
      }
      sendEvent(scenesEventCategory, 'SceneNameChanged', {
        sceneUuid: `uuid-${oldSceneName}`,
        oldSceneName,
        sceneName: newSceneName,
      });
    },
    addSceneByHand: (sceneName) => {
      sceneNames.unshift(sceneName);
      sendEvent(scenesEventCategory, 'SceneCreated', {
        sceneName,
        sceneUuid: `uuid-${sceneName}`,
        isGroup: false,
      });
      sendSceneListChanged();
    },
    removeSceneWithoutAnEvent: (sceneName) => {
      sceneNames.splice(sceneNames.indexOf(sceneName), 1);
    },
    setStudioModeByHand: (isOn) => {
      isStudioModeOn = isOn;
      if (isOn) {
        previewSceneName = programSceneName;
      }
      sendEvent(uiEventCategory, 'StudioModeStateChanged', { studioModeEnabled: isOn });
    },
    stopAnsweringSceneSwitches: () => {
      isAnsweringSceneSwitches = false;
    },
    close: () => {
      isOpen = false;
      closeEveryConnection();
    },
    reopen: () => {
      isOpen = true;
    },
  };
}

/** obs-websocket's authentication string: base64(sha256(base64(sha256(password + salt)) + challenge)). */
function hashPassword(password: string, salt: string, challenge: string): string {
  const secret = createHash('sha256').update(password + salt).digest('base64');
  return createHash('sha256').update(secret + challenge).digest('base64');
}

function sendMessage(socket: WebSocket, op: number, data: unknown): void {
  socket.send(JSON.stringify({ op, d: data }));
}

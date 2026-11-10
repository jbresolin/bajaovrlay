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
// again on the same port. And it can half answer, as a frozen OBS does: take the
// connection and never say Hello, or let the server in and never answer GetSceneList.
// Free of Vitest, so the chaos suite's Playwright tests (apps/control/e2e/chaos) open it
// too, for a real server process; Vitest tests call startFakeObs
// (fakeObsWebSocketServer.testSupport.ts), which closes it when the test ends.
import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { type WebSocket, WebSocketServer } from 'ws';

import { type CountWaitedOn, createCountWaitedOn } from './countWaitedOn.testSupport.js';
import type {
  FakeObs,
  FakeObsSetup,
  RequestReceivedByFakeObs,
} from './fakeObsControls.testSupport.js';
import {
  authenticationFailedCloseCode,
  eventOpCode,
  hashPassword,
  helloOpCode,
  identifiedOpCode,
  identifyOpCode,
  requestOpCode,
  requestResponseOpCode,
  requestSucceededStatusCode,
  resourceNotFoundStatusCode,
  scenesEventCategory,
  sendMessage,
  studioModeNotActiveStatusCode,
  uiEventCategory,
  unknownRequestTypeStatusCode,
} from './fakeObsProtocol.testSupport.js';

export type { FakeObs, FakeObsSetup } from './fakeObsControls.testSupport.js';

/** One connected client and what it is allowed to hear. */
type FakeObsClient = { socket: WebSocket; isIdentified: boolean; eventSubscriptions: number };

/**
 * Opens a fake OBS with the given setup on a free port. Every call builds its own server
 * and its own scenes. The caller closes it with `closeForGood`: a Vitest test through
 * startFakeObs, a Playwright test (the chaos suite) in its own `finally`.
 */
export async function openFakeObs(
  setup: FakeObsSetup,
): Promise<FakeObs & { closeForGood: () => Promise<void> }> {
  const sceneNames = [...setup.sceneNames];
  let programSceneName = setup.programSceneName;
  let previewSceneName = setup.previewSceneName;
  let isStudioModeOn = setup.isStudioModeOn;
  let isOpen = true;
  let isAnsweringSceneSwitches = true;
  let isGreetingNewConnections = true;
  let isAnsweringSceneListReads = true;
  const attemptsRefusedWhileClosed = createCountWaitedOn();
  const connectionsLeftWithoutHello = createCountWaitedOn();
  const requestsReceived: RequestReceivedByFakeObs[] = [];
  const requestCountsByType = new Map<string, CountWaitedOn>();
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
      attemptsRefusedWhileClosed.addOne();
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
    if (!isGreetingNewConnections) {
      connectionsLeftWithoutHello.addOne();
      return;
    }
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
      readRequestCountOfType(requestType).addOne();
      answerRequest(client, String(message.d.requestId), requestType, requestData);
    }
  }

  /** The count of requests received of one type, started at 0 the first time it is read. */
  function readRequestCountOfType(requestType: string): CountWaitedOn {
    let requestCount = requestCountsByType.get(requestType);
    if (requestCount === undefined) {
      requestCount = createCountWaitedOn();
      requestCountsByType.set(requestType, requestCount);
    }
    return requestCount;
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
        if (!isAnsweringSceneListReads) {
          return;
        }
        answer(requestSucceededStatusCode, null, buildSceneListAnswer());
        return;
      case 'GetStudioModeEnabled':
        answer(requestSucceededStatusCode, null, { studioModeEnabled: isStudioModeOn });
        return;
      case 'SetCurrentProgramScene':
        if (!sceneNames.includes(sceneName)) {
          answer(
            resourceNotFoundStatusCode,
            `No source was found by the name of \`${sceneName}\`.`,
          );
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
          answer(
            resourceNotFoundStatusCode,
            `No source was found by the name of \`${sceneName}\`.`,
          );
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

  /** Closes for good: every connection dropped, the port given back. */
  async function closeForGood(): Promise<void> {
    closeEveryConnection();
    webSocketServer.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }

  return {
    address: `ws://127.0.0.1:${port}`,
    readRequestsReceived: () => [...requestsReceived],
    waitForRequest: (requestType, numberOfRequests = 1) =>
      readRequestCountOfType(requestType).waitUntilItReaches(numberOfRequests),
    countAttemptsRefusedWhileClosed: attemptsRefusedWhileClosed.read,
    waitForAttemptsRefusedWhileClosed: attemptsRefusedWhileClosed.waitUntilItReaches,
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
    stopGreetingNewConnections: () => {
      isGreetingNewConnections = false;
    },
    greetNewConnectionsAgain: () => {
      isGreetingNewConnections = true;
    },
    waitForConnectionsLeftWithoutHello: connectionsLeftWithoutHello.waitUntilItReaches,
    stopAnsweringSceneListReads: () => {
      isAnsweringSceneListReads = false;
    },
    answerSceneListReadsAgain: () => {
      isAnsweringSceneListReads = true;
    },
    close: () => {
      isOpen = false;
      closeEveryConnection();
    },
    reopen: () => {
      isOpen = true;
    },
    closeForGood,
  };
}

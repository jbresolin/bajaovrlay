/**
 * One HEAD request for a Date header (apps/server)
 *
 * What this module is for:
 *   The HTTP Date client (httpDateClient.ts, BAJAOVRLAY-76) asks web servers their time
 *   through one HEAD request at a time. openConnectionsForHeadRequests makes them through
 *   node:http and node:https (no dependency), with a timeout, ends one at once when the
 *   server clock's discipline stops, and closes every connection when the poll ends.
 *
 * What these tests prove (against a web server on this machine, 127.0.0.1; no internet):
 *   - A HEAD is sent, and the server's Date header comes back as written.
 *   - Two requests to one server share one connection (only the first pays the TLS
 *     handshake on a real HTTPS server), and closing the poll's connections closes it.
 *   - A server that never answers is a timeout, and its connection is closed.
 *   - An abort mid-request (the discipline's stop) ends it at once, as "aborted", and its
 *     connection is closed: nothing stays open after the server stops.
 *   - A port with nothing listening is "unreachable".
 *
 * What these tests deliberately do not cover:
 *   - What the client does with the header; httpDateClient.test.ts.
 *   - HTTPS itself (TLS is node:https's): the local server speaks plain HTTP.
 */
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';

import { describe, expect, it, onTestFinished } from 'vitest';

import { type ConnectionsForHeadRequests, openConnectionsForHeadRequests } from './httpHeadRequest.js';

/** The Date header the local server writes: 10 October 2026, 13:00:04 UTC. */
const dateHeaderOfTheLocalServer = 'Sat, 10 Oct 2026 13:00:04 GMT';

/** What the local web server saw: each request's method, and each connection's close. */
type WhatTheLocalServerSaw = {
  methods: string[];
  countConnectionsEverOpened: () => number;
  countConnectionsOpen: () => number;
  /** Resolves once a request has arrived. */
  firstRequestArrived: Promise<void>;
};

/**
 * Starts a web server on 127.0.0.1 at a free port, answering HEAD with the Date header, or
 * never answering. Closed when the test ends.
 */
async function startALocalWebServer(behaviour: 'answers' | 'neverAnswers'): Promise<{
  address: string;
  saw: WhatTheLocalServerSaw;
}> {
  const methods: string[] = [];
  const openSockets = new Set<Socket>();
  let connectionsEverOpened = 0;
  let noteTheFirstRequest: () => void = () => {};
  const firstRequestArrived = new Promise<void>((resolve) => {
    noteTheFirstRequest = resolve;
  });
  const server: Server = createServer((request: IncomingMessage, response) => {
    methods.push(request.method ?? '');
    noteTheFirstRequest();
    if (behaviour === 'neverAnswers') {
      return;
    }
    // With no Content-Length, Node's server closes the connection after a HEAD answer;
    // Cloudflare's, NTP.br's and Google's send one, and keep it open.
    response.writeHead(200, { Date: dateHeaderOfTheLocalServer, 'Content-Length': '0' });
    response.end();
  });
  server.on('connection', (socket) => {
    openSockets.add(socket);
    connectionsEverOpened += 1;
    socket.on('close', () => openSockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  onTestFinished(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const { port } = server.address() as AddressInfo;
  return {
    address: `http://127.0.0.1:${port}`,
    saw: {
      methods,
      countConnectionsEverOpened: () => connectionsEverOpened,
      countConnectionsOpen: () => openSockets.size,
      firstRequestArrived,
    },
  };
}

/** The connections of one poll, closed when the test ends. */
function openTheConnectionsOfAPoll(): ConnectionsForHeadRequests {
  const connections = openConnectionsForHeadRequests();
  onTestFinished(() => {
    connections.closeEveryConnection();
  });
  return connections;
}

/** Waits until a condition holds, checking every 10 ms, for up to 2 s. */
async function waitUntil(condition: () => boolean): Promise<boolean> {
  for (let check = 0; check < 200; check += 1) {
    if (condition()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return condition();
}

describe('the HEAD requests of one poll', () => {
  it("sends a HEAD and hands back the server's Date header as written", async () => {
    // Arrange: a local server that answers.
    const localServer = await startALocalWebServer('answers');

    // Act: one request.
    const outcome = await openTheConnectionsOfAPoll().sendHeadRequest(localServer.address, {
      timeoutMs: 2_000,
      abortSignal: new AbortController().signal,
    });

    // Assert: the header, from a HEAD.
    expect(outcome, 'the Date header as the server wrote it').toEqual({
      isAnswered: true,
      dateHeader: dateHeaderOfTheLocalServer,
    });
    expect(localServer.saw.methods, 'HEAD: no body is ever downloaded').toEqual(['HEAD']);
  });

  it("shares one connection between a server's requests, and closes it when the poll ends", async () => {
    // Arrange: a local server that answers; the connections of one poll.
    const localServer = await startALocalWebServer('answers');
    const connections = openTheConnectionsOfAPoll();
    const requestOptions = { timeoutMs: 2_000, abortSignal: new AbortController().signal };

    // Act: two requests, one after the other; then the poll ends.
    await connections.sendHeadRequest(localServer.address, requestOptions);
    await connections.sendHeadRequest(localServer.address, requestOptions);
    const connectionsOpenBetweenTheRequests = localServer.saw.countConnectionsOpen();
    connections.closeEveryConnection();

    // Assert: one connection for both, open until the poll ended, then closed.
    expect(localServer.saw.countConnectionsEverOpened(), 'one connection for both').toBe(1);
    expect(connectionsOpenBetweenTheRequests, 'kept open between them').toBe(1);
    expect(
      await waitUntil(() => localServer.saw.countConnectionsOpen() === 0),
      'closed when the poll ends',
    ).toBe(true);
  });

  it('times out on a server that never answers, and closes the connection', async () => {
    // Arrange: a local server that takes the request and never answers.
    const localServer = await startALocalWebServer('neverAnswers');

    // Act: one request with a 200 ms timeout.
    const outcome = await openTheConnectionsOfAPoll().sendHeadRequest(localServer.address, {
      timeoutMs: 200,
      abortSignal: new AbortController().signal,
    });

    // Assert: a timeout, and the server sees the connection close.
    expect(outcome, 'a timeout').toEqual({ isAnswered: false, reason: 'timeout' });
    expect(
      await waitUntil(() => localServer.saw.countConnectionsOpen() === 0),
      'the connection is closed, not left waiting',
    ).toBe(true);
  });

  it('ends at once when aborted mid-request, and closes the connection', async () => {
    // Arrange: a local server that never answers; a request under way, already received.
    const localServer = await startALocalWebServer('neverAnswers');
    const stopController = new AbortController();
    const requestEnded = openTheConnectionsOfAPoll().sendHeadRequest(localServer.address, {
      timeoutMs: 10_000,
      abortSignal: stopController.signal,
    });
    await localServer.saw.firstRequestArrived;

    // Act: the discipline stops.
    const momentOfTheStopMs = performance.now();
    stopController.abort();
    const outcome = await requestEnded;
    const msToEnd = performance.now() - momentOfTheStopMs;

    // Assert: "aborted" at once (well before the 10 s timeout), and the connection closed.
    expect(outcome, 'aborted, not a timeout').toEqual({ isAnswered: false, reason: 'aborted' });
    expect(msToEnd, 'at once').toBeLessThan(1_000);
    expect(
      await waitUntil(() => localServer.saw.countConnectionsOpen() === 0),
      'nothing stays open after the stop',
    ).toBe(true);
  });

  it('calls a port with nothing listening unreachable', async () => {
    // Arrange: a local server started and closed, so its port is free.
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    await new Promise<void>((resolve) => server.close(() => resolve()));

    // Act: one request to that port.
    const outcome = await openTheConnectionsOfAPoll().sendHeadRequest(`http://127.0.0.1:${port}`, {
      timeoutMs: 2_000,
      abortSignal: new AbortController().signal,
    });

    // Assert: unreachable, the reason given for the log.
    expect(outcome, 'nothing listens there').toMatchObject({
      isAnswered: false,
      reason: 'unreachable',
      detail: 'ECONNREFUSED',
    });
  });
});

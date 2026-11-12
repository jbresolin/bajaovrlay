// Test support: web servers that answer HEAD with a Date header, on Vitest's fake time,
// handed to the HTTP Date client as its `sendHeadRequest` (no socket, no network). Each
// server has its own clock against real time, and each request its own delay out and back,
// so a test can say exactly how wrong a midpoint could be. A server reads its clock when
// the request reaches it, and writes the whole second, as real web servers do.
// Every call builds fresh objects, so no test sees another's.
import type { HeadRequestOutcome, SendHeadRequest } from './httpDateClient.js';

/** The delay of one request on the way to the server, and of its answer on the way back. */
export type DelaysOfOneRequest = { outMs: number; backMs: number };

/** What a fake server does with each request. */
export type FakeServerBehaviour =
  | 'answers'
  | 'neverAnswers'
  | { answersWithTheDateHeader: string | undefined };

/** One fake web server: its address, its clock, its network, what it does. */
export type FakeHttpDateServerSettings = {
  address: string;
  /** How far its clock is ahead of real time: 400 for a server 0.4 s fast. */
  clockAheadOfRealTimeMs?: number;
  /** The delays of its requests, in turn; 15 ms each way unless given. */
  delaysOfEachRequest?: readonly DelaysOfOneRequest[];
  behaviour?: FakeServerBehaviour;
};

/**
 * Builds the fake servers. `readRealTimeMs` is real time in the test's world. Returns the
 * request function for the client, and what the test reads afterwards.
 */
export function createFakeHttpDateServers(
  serverSettings: readonly FakeHttpDateServerSettings[],
  readRealTimeMs: () => number,
) {
  const requestsReceived = new Map<string, number>();
  const ticksMissedByEachRequest = new Map<string, number[]>();
  let requestsStillOpen = 0;

  /**
   * Notes how far from its second ticking over the server's clock was when a request
   * reached it: +3 for 3 ms after the tick, −3 for 3 ms before.
   */
  function noteHowFarFromTheTickARequestArrived(
    server: FakeHttpDateServerSettings,
    serverClockMs: number,
  ): void {
    const msIntoTheSecond = serverClockMs - Math.floor(serverClockMs / 1000) * 1000;
    const msFromTheNearestTick = msIntoTheSecond < 500 ? msIntoTheSecond : msIntoTheSecond - 1000;
    const notedSoFar = ticksMissedByEachRequest.get(server.address) ?? [];
    ticksMissedByEachRequest.set(server.address, [...notedSoFar, msFromTheNearestTick]);
  }

  /** The settings of the server at an address; a test asking another is a test bug. */
  function findTheServer(address: string): FakeHttpDateServerSettings {
    const server = serverSettings.find((settings) => settings.address === address);
    if (server === undefined) {
      throw new Error(`no fake server at ${address}`);
    }
    return server;
  }

  /** The Date header the server writes now: its clock, cut to the whole second. */
  function writeTheDateHeaderNow(server: FakeHttpDateServerSettings): string | undefined {
    const behaviour = server.behaviour ?? 'answers';
    if (typeof behaviour === 'object') {
      return behaviour.answersWithTheDateHeader;
    }
    const serverClockMs = readRealTimeMs() + (server.clockAheadOfRealTimeMs ?? 0);
    noteHowFarFromTheTickARequestArrived(server, serverClockMs);
    const wholeSecondMs = Math.floor(serverClockMs / 1000) * 1000;
    return new Date(wholeSecondMs).toUTCString();
  }

  const sendHeadRequest: SendHeadRequest = (address, options) => {
    const server = findTheServer(address);
    const requestNumber = requestsReceived.get(address) ?? 0;
    requestsReceived.set(address, requestNumber + 1);
    const delaysInTurn = server.delaysOfEachRequest ?? [{ outMs: 15, backMs: 15 }];
    const delays = delaysInTurn[requestNumber % delaysInTurn.length] ?? { outMs: 15, backMs: 15 };
    requestsStillOpen += 1;

    return new Promise<HeadRequestOutcome>((resolve) => {
      let isFinished = false;
      const timers: Array<ReturnType<typeof setTimeout>> = [];
      function finish(outcome: HeadRequestOutcome): void {
        if (isFinished) {
          return;
        }
        isFinished = true;
        requestsStillOpen -= 1;
        timers.forEach((timer) => clearTimeout(timer));
        options.abortSignal.removeEventListener('abort', finishAsAborted);
        resolve(outcome);
      }
      function finishAsAborted(): void {
        finish({ isAnswered: false, reason: 'aborted' });
      }
      if (options.abortSignal.aborted) {
        finishAsAborted();
        return;
      }
      options.abortSignal.addEventListener('abort', finishAsAborted, { once: true });
      timers.push(
        setTimeout(() => finish({ isAnswered: false, reason: 'timeout' }), options.timeoutMs),
      );
      if (server.behaviour === 'neverAnswers') {
        return;
      }
      timers.push(
        setTimeout(() => {
          const dateHeader = writeTheDateHeaderNow(server);
          timers.push(
            setTimeout(() => finish({ isAnswered: true, dateHeader }), delays.backMs),
          );
        }, delays.outMs),
      );
    });
  };

  return {
    sendHeadRequest,
    /** How many requests the server at this address received. */
    countRequestsReceivedBy: (address: string) => requestsReceived.get(address) ?? 0,
    /** For each request that reached this server: ms from its second's tick, in order. */
    readHowFarFromTheTickEachRequestArrived: (address: string) => [
      ...(ticksMissedByEachRequest.get(address) ?? []),
    ],
    /** Requests sent and not yet answered, timed out or aborted, across every server. */
    countRequestsStillOpen: () => requestsStillOpen,
  };
}

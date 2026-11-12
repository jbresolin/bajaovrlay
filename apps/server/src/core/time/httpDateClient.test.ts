/**
 * Real time from the Date headers of web servers (apps/server)
 *
 * What this module is for:
 *   Some networks block NTP (UDP 123) but let HTTPS through. A web server's Date header
 *   says its time to the whole second; read at the moment its second ticks over, it gives
 *   tens of milliseconds, as htpdate does (BAJAOVRLAY-76). The client asks each server a
 *   few HEAD requests: the first says the second, each next one is timed so its midpoint
 *   lands where that server's second should tick, and the answer (ticked or not yet)
 *   halves what is left. A result is kept only when two servers agree within 100 ms.
 *
 * What these tests prove (on fake time, against fake servers handed to the client in
 *   place of real requests; no socket, no network):
 *   - With delays of 10 to 20 ms each way, uneven, the offset found is within 10 ms of the
 *     truth: 5 ms for the worst one-sided delay, plus under 4 ms left by the last halving.
 *     One request alone would leave a whole second.
 *   - It takes eight requests per server at most; after the first, each is timed to reach
 *     the server as its second ticks over, and the last ones land within 10 ms of it.
 *   - Two servers whose clocks are 400 ms apart give no answer; with a third that agrees
 *     with one of them, the answer is the first of the two that agree.
 *   - A server that never answers is a timeout, named in the problems; the others still
 *     answer.
 *   - A Date header that will not parse, or none at all, is named in the problems, the
 *     header quoted.
 *   - The abort signal (the discipline's stop) ends the poll mid-request: no request is
 *     left open and none is sent after it.
 *
 * What these tests deliberately do not cover:
 *   - The real HEAD request (fetch), its timeout and its abort on a socket;
 *     httpHeadRequest.test.ts, against a server on this machine.
 *   - When the server clock asks HTTPS instead of NTP; serverClockHttpFallback.test.ts.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  createFakeHttpDateServers,
  type FakeHttpDateServerSettings,
} from './fakeHttpDateServers.testSupport.js';
import { maximumRequestsPerServer, pollHttpDateServers } from './httpDateClient.js';

/** 10 October 2026, 13:00 UTC (10:00 in Brasília): the enduro is an hour in. */
const tenOClockOfTheEnduroMs = Date.parse('2026-10-10T13:00:00.000Z');

/**
 * How far real time is ahead of the machine's monotonic clock: what the client measures.
 * The 0.4567 s is there so the true offset never falls on a whole second.
 */
const trueOffsetMs = tenOClockOfTheEnduroMs + 456.7;

/** Delays of 10 to 20 ms each way, uneven, as a good uplink from the track has. */
const unevenDelaysOfAGoodUplink = [
  { outMs: 12, backMs: 18 },
  { outMs: 20, backMs: 10 },
  { outMs: 15, backMs: 15 },
  { outMs: 11, backMs: 19 },
  { outMs: 17, backMs: 13 },
  { outMs: 19, backMs: 11 },
  { outMs: 14, backMs: 16 },
  { outMs: 10, backMs: 20 },
];

/** Fakes the machine's clock and timers; real time runs `trueOffsetMs` ahead of it. */
function startTheFakeClockOfTheMachine(): {
  readLocalTimeMs: () => number;
  readRealTimeMs: () => number;
} {
  vi.useFakeTimers({ toFake: ['performance', 'setTimeout', 'clearTimeout'] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const readLocalTimeMs = () => performance.now();
  return { readLocalTimeMs, readRealTimeMs: () => readLocalTimeMs() + trueOffsetMs };
}

/** Starts one poll of the fake servers and lets fake time run until it ends. */
async function pollTheFakeServers(serverSettings: readonly FakeHttpDateServerSettings[]) {
  const machine = startTheFakeClockOfTheMachine();
  const fakeServers = createFakeHttpDateServers(serverSettings, machine.readRealTimeMs);
  const pollEnded = pollHttpDateServers({
    serverAddresses: serverSettings.map((settings) => settings.address),
    readLocalTimeMs: machine.readLocalTimeMs,
    sendHeadRequest: fakeServers.sendHeadRequest,
    abortSignal: new AbortController().signal,
  });
  await vi.advanceTimersByTimeAsync(30_000);
  return { outcome: await pollEnded, fakeServers };
}

describe('the HTTP Date client', () => {
  it('finds the offset within 10 ms by timing its requests on the second boundary', async () => {
    // Arrange: three servers on real time, behind a good uplink with uneven delays.
    const serverSettings = [
      'https://www.cloudflare.com',
      'https://www.ntp.br',
      'https://www.google.com',
    ].map((address) => ({ address, delaysOfEachRequest: unevenDelaysOfAGoodUplink }));

    // Act: one poll.
    const { outcome, fakeServers } = await pollTheFakeServers(serverSettings);

    // Assert: answered by the first server, within 10 ms, in eight requests or fewer each.
    expect(outcome.isAnswered, 'two servers agree').toBe(true);
    if (!outcome.isAnswered) {
      return;
    }
    expect(outcome.serverName, 'the first server that agrees is named').toBe('www.cloudflare.com');
    expect(
      Math.abs(outcome.answer.offsetMs - trueOffsetMs),
      'within the one-sided delay and the last halving',
    ).toBeLessThan(10);
    expect(
      fakeServers.countRequestsReceivedBy('https://www.cloudflare.com'),
      'a few requests, never a flood',
    ).toBeLessThanOrEqual(maximumRequestsPerServer);
  });

  it("times its requests so that they reach the server as its second ticks over", async () => {
    // Arrange: two servers on real time, behind the same uneven delays.
    const serverSettings = ['https://www.cloudflare.com', 'https://www.ntp.br'].map(
      (address) => ({ address, delaysOfEachRequest: unevenDelaysOfAGoodUplink }),
    );

    // Act: one poll.
    const { fakeServers } = await pollTheFakeServers(serverSettings);

    // Assert: the first request lands anywhere in the second; each later one is aimed
    // closer to the tick, and the last three land within 20 ms of it: the way out takes
    // 10 to 20 ms where the client counts on half the round trip (15), so 5 ms either way,
    // plus the offset's own error, under 10 ms (the test above).
    const msFromTheTick = fakeServers.readHowFarFromTheTickEachRequestArrived(
      'https://www.cloudflare.com',
    );
    expect(msFromTheTick.length, 'several requests, one per tick').toBeGreaterThan(4);
    for (const lastRequestMsFromTheTick of msFromTheTick.slice(-3)) {
      expect(Math.abs(lastRequestMsFromTheTick), 'on the second boundary').toBeLessThan(20);
    }
  });

  // Each row is a set of servers and whether their clocks agree enough to be believed.
  it.each([
    {
      // Two servers 0.4 s apart: one of them is wrong, and nothing says which.
      name: 'two servers 400 ms apart give no answer',
      servers: [
        { address: 'https://www.cloudflare.com' },
        { address: 'https://www.ntp.br', clockAheadOfRealTimeMs: 400 },
      ],
      expected: { isAnswered: false },
    },
    {
      // A third server agrees with the first: the one 0.4 s off is outvoted.
      name: 'a third server that agrees with the first decides',
      servers: [
        { address: 'https://www.cloudflare.com' },
        { address: 'https://www.ntp.br', clockAheadOfRealTimeMs: 400 },
        { address: 'https://www.google.com' },
      ],
      expected: { isAnswered: true, serverName: 'www.cloudflare.com' },
    },
    {
      // The first is the odd one out: the answer comes from the second.
      name: 'the first server off, the next two agree',
      servers: [
        { address: 'https://www.cloudflare.com', clockAheadOfRealTimeMs: -400 },
        { address: 'https://www.ntp.br' },
        { address: 'https://www.google.com' },
      ],
      expected: { isAnswered: true, serverName: 'www.ntp.br' },
    },
  ])('$name', async ({ servers, expected }) => {
    // Arrange: the servers of the row.

    // Act: one poll.
    const { outcome } = await pollTheFakeServers(servers);

    // Assert: an answer only from two servers that agree.
    expect(outcome, 'kept only when two servers agree within 100 ms').toMatchObject(expected);
  });

  it('says the two servers disagree, and by how much', async () => {
    // Arrange: two servers 0.4 s apart.
    const servers = [
      { address: 'https://www.cloudflare.com' },
      { address: 'https://www.ntp.br', clockAheadOfRealTimeMs: 400 },
    ];

    // Act: one poll.
    const { outcome } = await pollTheFakeServers(servers);

    // Assert: the problem names the disagreement, for the log.
    expect(outcome.isAnswered, 'no answer').toBe(false);
    expect(
      !outcome.isAnswered && outcome.problems.join(' | '),
      'the log line says why no answer was kept',
    ).toMatch(/disagree by (39\d|40\d) ms/);
  });

  it('names a server that never answers as a timeout, and still answers from the others', async () => {
    // Arrange: NTP.br's web server never answers; the other two do.
    const servers: FakeHttpDateServerSettings[] = [
      { address: 'https://www.cloudflare.com' },
      { address: 'https://www.ntp.br', behaviour: 'neverAnswers' },
      { address: 'https://www.google.com' },
    ];

    // Act: one poll.
    const { outcome } = await pollTheFakeServers(servers);

    // Assert: answered by the two that answer; with only one of them, the timeout is told.
    expect(outcome.isAnswered, 'two servers still agree').toBe(true);
    const { outcome: outcomeWithTwoServers } = await pollTheFakeServers(servers.slice(0, 2));
    expect(outcomeWithTwoServers, 'one server alone is not believed').toEqual({
      isAnswered: false,
      problems: ['www.ntp.br: timeout', 'only one server answered (www.cloudflare.com)'],
    });
  });

  // Each row is a Date header a server could send that says no time.
  it.each([
    // Not a date at all: a proxy filling the header with its own text.
    { name: 'a Date that will not parse', dateHeader: 'ontem à tarde', expected: 'www.ntp.br: unreadable Date header ("ontem à tarde")' },
    // A server that sends no Date header (allowed when it has no clock).
    { name: 'no Date header', dateHeader: undefined, expected: 'www.ntp.br: no Date header' },
  ])('names $name in the problems', async ({ dateHeader, expected }) => {
    // Arrange: Cloudflare on real time, NTP.br's web server with the row's header.
    const servers: FakeHttpDateServerSettings[] = [
      { address: 'https://www.cloudflare.com' },
      { address: 'https://www.ntp.br', behaviour: { answersWithTheDateHeader: dateHeader } },
    ];

    // Act: one poll.
    const { outcome } = await pollTheFakeServers(servers);

    // Assert: no answer, the header named.
    expect(outcome.isAnswered, 'only one server answered').toBe(false);
    expect(!outcome.isAnswered && outcome.problems, 'the header is quoted for the log').toContain(
      expected,
    );
  });

  it('ends at once when aborted mid-request, leaving no request open and sending none', async () => {
    // Arrange: two servers on real time, a poll under way (each has a request in flight).
    const machine = startTheFakeClockOfTheMachine();
    const serverSettings = [
      { address: 'https://www.cloudflare.com' },
      { address: 'https://www.ntp.br' },
    ];
    const fakeServers = createFakeHttpDateServers(serverSettings, machine.readRealTimeMs);
    const stopController = new AbortController();
    const pollEnded = pollHttpDateServers({
      serverAddresses: serverSettings.map((settings) => settings.address),
      readLocalTimeMs: machine.readLocalTimeMs,
      sendHeadRequest: fakeServers.sendHeadRequest,
      abortSignal: stopController.signal,
    });
    await vi.advanceTimersByTimeAsync(5);
    const requestsOpenBeforeTheStop = fakeServers.countRequestsStillOpen();

    // Act: the discipline stops; then ten seconds pass.
    stopController.abort();
    const outcome = await pollEnded;
    const requestsSentAtTheStop = fakeServers.countRequestsReceivedBy('https://www.ntp.br');
    await vi.advanceTimersByTimeAsync(10_000);

    // Assert: requests were in flight; the poll ended stopped, with none left open, and
    // nothing was sent after it.
    expect(requestsOpenBeforeTheStop, 'the stop came mid-request').toBe(2);
    expect(outcome, 'a stopped poll answers nothing').toEqual({
      isAnswered: false,
      problems: ['stopped'],
    });
    expect(fakeServers.countRequestsStillOpen(), 'every request closed').toBe(0);
    expect(
      fakeServers.countRequestsReceivedBy('https://www.ntp.br'),
      'nothing sent after the stop',
    ).toBe(requestsSentAtTheStop);
  });
});

/**
 * Server connection: the server's clock (apps/control)
 *
 * What this module is for:
 *   "Edição rápida" shows the time a clock on air shows, worked out on this computer. The
 *   reading on air was stamped with the server's clock, so the page needs "now" on the
 *   server's clock too. Every hello and slice message carries the server's time
 *   (`serverNowMs`); the connection hands each one to the shared server-aligned clock,
 *   as the renderer does.
 *
 * What these tests prove:
 *   - After a hello and two slice messages, the shared "now" reads the server's time on
 *     a computer whose own clock is 2.3 seconds behind.
 *   - A message without `serverNowMs` (an older server) gives no sample, so the shared
 *     "now" stays this computer's own clock.
 *   - "No sample" is not "offset zero": a correction already learned is left exactly as
 *     it was by hello and slice messages that carry no server time.
 *   - The `time` message the server sends every ten seconds gives a sample exactly as a
 *     hello does, and the page does nothing else with it: the store is untouched and no
 *     log line is written.
 *
 * What these tests deliberately do not cover:
 *   - How samples become one offset (the median of the last five); that is
 *     packages/shared/src/clock/serverClockOffsetSamples.test.ts.
 *   - The delay of the network, which makes every sample a little late; nothing here or
 *     in the page measures it.
 */
import { forgetServerClockSamples, readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { connectControlPageToFakeServer } from './connectionToFakeServer.testSupport';
import {
  buildRaceClockInstanceOnTheClockLayer,
  buildSlicesWithTheRaceClockOnAir,
} from './slicesLikeTheServerSends.testSupport';

const momentTheClockWentOnAir = '2026-10-12T13:00:00.000Z';
// 10:15 in Brasília on the server, while this computer's clock reads 2.3 seconds earlier.
const serverTimeMs = Date.parse('2026-10-12T13:15:00.000Z');
const thisComputersTimeMs = serverTimeMs - 2_300;

afterEach(() => {
  // The samples live outside the test (on the page's global object, shared with graphics),
  // so each test hands the next one a clock that has heard nothing from a server.
  forgetServerClockSamples();
  vi.useRealTimers();
});

describe('the server clock samples of the control page', () => {
  it('reads the time of the server after a hello and two slices, on a computer 2.3 s behind', () => {
    // Arrange: this computer's clock held 2.3 seconds behind the server's.
    vi.useFakeTimers();
    vi.setSystemTime(thisComputersTimeMs);
    const { fakeServerSocket } = connectControlPageToFakeServer();
    fakeServerSocket.acceptConnection();

    // Act: the server says hello and sends two changes, each stamped with its own time.
    fakeServerSocket.sendMessage({
      type: 'hello',
      slices: buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir),
      serverNowMs: serverTimeMs,
    });
    fakeServerSocket.sendMessage({
      type: 'slice',
      name: 'instances',
      slice: [buildRaceClockInstanceOnTheClockLayer(momentTheClockWentOnAir)],
      serverNowMs: serverTimeMs,
    });
    fakeServerSocket.sendMessage({
      type: 'slice',
      name: 'instances',
      slice: [],
      serverNowMs: serverTimeMs,
    });

    // Assert: "now" for the page is the server's time, not this computer's.
    expect(
      readServerAlignedTimeMs(),
      'the shared clock must read the time of the server, 2.3 seconds ahead of this computer',
    ).toBe(serverTimeMs);
  });

  it('keeps the clock of this computer when the messages carry no server time', () => {
    // Arrange: the same computer, 2.3 seconds behind.
    vi.useFakeTimers();
    vi.setSystemTime(thisComputersTimeMs);
    const { fakeServerSocket } = connectControlPageToFakeServer();
    fakeServerSocket.acceptConnection();

    // Act: a hello with no time in it, as a server from before this field would send.
    fakeServerSocket.sendMessage({
      type: 'hello',
      slices: buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir),
    });

    // Assert: with nothing to go by, "now" is this computer's own clock.
    expect(
      readServerAlignedTimeMs(),
      'without a server time the shared clock must read the clock of this computer',
    ).toBe(thisComputersTimeMs);
  });

  it('keeps a correction already learned when later messages carry no server time', () => {
    // Arrange: the same computer, which learned from a hello that it is 2.3 seconds behind.
    vi.useFakeTimers();
    vi.setSystemTime(thisComputersTimeMs);
    const { fakeServerSocket } = connectControlPageToFakeServer();
    fakeServerSocket.acceptConnection();
    fakeServerSocket.sendMessage({
      type: 'hello',
      slices: buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir),
      serverNowMs: serverTimeMs,
    });

    // Act: four slice messages and a hello arrive with no server time in them. Read as
    // "the clocks agree" (an offset of zero), five of them would outvote the one real
    // sample and put the page back on this computer's own clock.
    for (let messageNumber = 1; messageNumber <= 4; messageNumber += 1) {
      fakeServerSocket.sendMessage({ type: 'slice', name: 'instances', slice: [] });
    }
    fakeServerSocket.sendMessage({
      type: 'hello',
      slices: buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir),
    });

    // Assert: "now" for the page is still the server's time.
    expect(
      readServerAlignedTimeMs(),
      'a message without a server time must never count as an offset of zero',
    ).toBe(serverTimeMs);
  });
});

describe('the time message the server sends every ten seconds', () => {
  it('gives a sample exactly as a hello does, on a page whose hello carried no time', () => {
    // Arrange: this computer 2.3 seconds behind, connected by a hello with no time in it.
    vi.useFakeTimers();
    vi.setSystemTime(thisComputersTimeMs);
    const { fakeServerSocket } = connectControlPageToFakeServer();
    fakeServerSocket.acceptConnection();
    fakeServerSocket.sendMessage({
      type: 'hello',
      slices: buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir),
    });

    // Act: the server's time message arrives.
    fakeServerSocket.sendMessage({ type: 'time', serverNowMs: serverTimeMs });

    // Assert: "now" for the page is the server's time.
    expect(
      readServerAlignedTimeMs(),
      'a time message must put the shared clock on the time of the server',
    ).toBe(serverTimeMs);
  });

  it('changes nothing in the store and writes no log line', () => {
    // Arrange: a connected page, and what its store and its log hold at this point.
    vi.useFakeTimers();
    vi.setSystemTime(thisComputersTimeMs);
    const { fakeServerSocket, serverStateStore, recordedLogLines } =
      connectControlPageToFakeServer();
    fakeServerSocket.acceptConnection();
    fakeServerSocket.sendMessage({
      type: 'hello',
      slices: buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir),
      serverNowMs: serverTimeMs,
    });
    const storeStateBefore = serverStateStore.getState();
    const numberOfLogLinesBefore = recordedLogLines.length;

    // Act: a time message arrives.
    fakeServerSocket.sendMessage({ type: 'time', serverNowMs: serverTimeMs });

    // Assert: the store holds the very same state object (nothing was set, so no
    // component redraws every ten seconds), and the log has no new line.
    expect(serverStateStore.getState(), 'a time message must not touch the store').toBe(
      storeStateBefore,
    );
    expect(recordedLogLines.length, 'a time message must write no log line').toBe(
      numberOfLogLinesBefore,
    );
  });
});

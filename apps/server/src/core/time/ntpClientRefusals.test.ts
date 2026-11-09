/**
 * What comes back from an NTP server that is no answer (apps/server)
 *
 * What this module is for:
 *   ntpClient.ts asks one NTP server once (BAJAOVRLAY-62). The server clock may step on
 *   what it says, so anything that is not a true answer to this question, from this
 *   server, must be refused: a track-side NTP box without a GPS fix could otherwise step
 *   the clock by years, and a stray datagram could cancel a good exchange.
 *
 * What these tests prove (against a fake NTP server on a real UDP socket of this machine):
 *   - No answer in time, a malformed answer, an answer to another question, a
 *     kiss-of-death answer, a server that says it has lost its time (leap indicator 3,
 *     stratum 16) and an answer with a zero timestamp are each reported as no answer,
 *     with the reason; a kiss of death names its code.
 *   - A malformed packet, or one answering another question, does not end the wait: the
 *     right answer after it is still taken.
 *   - A packet from any other address is never read, even a well-formed one.
 *   - The socket is closed after a timeout.
 *
 * What these tests deliberately do not cover:
 *   - The arithmetic of a true answer; ntpClient.test.ts.
 *   - What a poll does after a refusal (the next server, slowing down); ntpPolls.test.ts.
 */
import { createSocket } from 'node:dgram';

import { describe, expect, it } from 'vitest';

import {
  buildAnswerOfAHealthyServer,
  buildAnswerOfAServerWithoutItsTime,
  buildAnswerWithAZeroTimestamp,
  buildKissOfDeathAnswer,
  buildMalformedAnswer,
  countOpenUdpSockets,
  createLocalClockReadingInTurn,
  startFakeNtpServer,
} from './fakeNtpServer.testSupport.js';
import { queryNtpServerOnce } from './ntpClient.js';

/** 10 October 2026, 13:00 UTC: the enduro is an hour in. */
const oneOClockOfTheEnduroMs = Date.parse('2026-10-10T13:00:00.000Z');

/** Long enough for an answer on this machine, short enough to keep the tests quick. */
const timeoutOfTheTestsMs = 300;

describe('what comes back that is no answer', () => {
  const answersThatAreNoAnswer = [
    // The uplink at the track is down, or a firewall drops UDP 123: nothing comes back.
    {
      name: 'nothing comes back in time',
      answerQuestion: () => undefined,
      expectedReason: 'timeout',
    },
    // Something answered, but not with an NTP packet.
    {
      name: 'the answer is not an NTP packet',
      answerQuestion: () => buildMalformedAnswer(),
      expectedReason: 'malformed',
    },
    // An answer that does not echo our question's timestamp is not an answer to it: a
    // late answer to an earlier question, or a forged one.
    {
      name: 'the answer is to another question',
      answerQuestion: () =>
        buildAnswerOfAHealthyServer(Buffer.alloc(48), {
          receivedAtMs: oneOClockOfTheEnduroMs,
          sentAtMs: oneOClockOfTheEnduroMs,
        }),
      expectedReason: 'malformed',
    },
    // The server says "you ask too often": its time must not be used.
    {
      name: 'the server sends a kiss of death',
      answerQuestion: (question: Buffer) => buildKissOfDeathAnswer(question, 'RATE'),
      expectedReason: 'kissOfDeath',
    },
    // A track-side NTP box without a GPS fix says "not synchronized" in its leap indicator.
    {
      name: 'the server says it is not synchronized (leap indicator 3)',
      answerQuestion: (question: Buffer) =>
        buildAnswerOfAServerWithoutItsTime(question, 'leapIndicator3'),
      expectedReason: 'unsynchronized',
    },
    // The same box may say it with stratum 16 instead.
    {
      name: 'the server says it is unsynchronized (stratum 16)',
      answerQuestion: (question: Buffer) =>
        buildAnswerOfAServerWithoutItsTime(question, 'stratum16'),
      expectedReason: 'unsynchronized',
    },
    // A zero receive timestamp would read as February 2036: a step of ten years.
    {
      name: 'the receive timestamp is zero',
      answerQuestion: (question: Buffer) => buildAnswerWithAZeroTimestamp(question, 'receive'),
      expectedReason: 'unsynchronized',
    },
    // The same for the transmit timestamp (RFC 4330: the client must refuse either).
    {
      name: 'the transmit timestamp is zero',
      answerQuestion: (question: Buffer) => buildAnswerWithAZeroTimestamp(question, 'transmit'),
      expectedReason: 'unsynchronized',
    },
  ];

  it.each(answersThatAreNoAnswer)(
    'reports no answer, with the reason, when $name',
    async ({ answerQuestion, expectedReason }) => {
      // Arrange: a fake server answering as this row says.
      const fakeServer = await startFakeNtpServer(answerQuestion);

      // Act: ask it once.
      const outcome = await queryNtpServerOnce({
        server: fakeServer.ipv4Address,
        readLocalTimeMs: createLocalClockReadingInTurn([
          oneOClockOfTheEnduroMs,
          oneOClockOfTheEnduroMs + 30,
        ]),
        timeoutMs: timeoutOfTheTestsMs,
      });

      // Assert: no answer, and why.
      expect(outcome.isAnswered, 'nothing usable came back').toBe(false);
      expect(!outcome.isAnswered && outcome.reason, 'the reason names what went wrong').toBe(
        expectedReason,
      );
    },
  );

  it('names the code of a kiss of death in its detail', async () => {
    // Arrange: a fake server that says DENY ("you may not ask me").
    const fakeServer = await startFakeNtpServer((question) =>
      buildKissOfDeathAnswer(question, 'DENY'),
    );

    // Act: ask it once.
    const outcome = await queryNtpServerOnce({
      server: fakeServer.ipv4Address,
      readLocalTimeMs: createLocalClockReadingInTurn([oneOClockOfTheEnduroMs]),
      timeoutMs: timeoutOfTheTestsMs,
    });

    // Assert: the code is in the detail, for the log.
    expect(!outcome.isAnswered && outcome.detail, 'the log must say which code').toBe('DENY');
  });

  it('waits past a packet that answers another question, and takes the answer after it', async () => {
    // Arrange: a fake server that first sends a stray answer to some other question, then
    // the answer to this one, from a server 4 s ahead.
    const fakeServer = await startFakeNtpServer((question) => [
      buildAnswerOfAHealthyServer(Buffer.alloc(48), {
        receivedAtMs: oneOClockOfTheEnduroMs,
        sentAtMs: oneOClockOfTheEnduroMs,
      }),
      buildAnswerOfAHealthyServer(question, {
        receivedAtMs: oneOClockOfTheEnduroMs + 4_010,
        sentAtMs: oneOClockOfTheEnduroMs + 4_010,
      }),
    ]);

    // Act: ask it once; the local clock reads one o'clock, then 20 ms later at each packet.
    const outcome = await queryNtpServerOnce({
      server: fakeServer.ipv4Address,
      readLocalTimeMs: createLocalClockReadingInTurn([
        oneOClockOfTheEnduroMs,
        oneOClockOfTheEnduroMs + 20,
      ]),
      timeoutMs: timeoutOfTheTestsMs,
    });

    // Assert: the stray packet did not end the wait; the answer after it was taken.
    expect(outcome.isAnswered, 'a stray packet must not cancel a good exchange').toBe(true);
    expect(outcome.isAnswered && outcome.answer.offsetMs, 'the offset of the real answer').toBe(
      4_000,
    );
  });

  it('never reads a packet from another address, even one that answers this question', async () => {
    // Arrange: the NTP server says nothing; a stranger on another port of this machine sends
    // a well-formed answer to the very question, as a forger who saw it would.
    const stranger = createSocket('udp4');
    await new Promise<void>((resolve) => stranger.bind(0, '127.0.0.1', resolve));
    const fakeServer = await startFakeNtpServer((question, sender) => {
      const forgedAnswer = buildAnswerOfAHealthyServer(question, {
        receivedAtMs: oneOClockOfTheEnduroMs + 3_600_000,
        sentAtMs: oneOClockOfTheEnduroMs + 3_600_000,
      });
      stranger.send(forgedAnswer, sender.port, sender.address);
      return undefined;
    });

    // Act: ask the server once.
    const outcome = await queryNtpServerOnce({
      server: fakeServer.ipv4Address,
      readLocalTimeMs: createLocalClockReadingInTurn([oneOClockOfTheEnduroMs]),
      timeoutMs: timeoutOfTheTestsMs,
    });
    stranger.close();

    // Assert: no answer: the forged one came from the wrong address.
    expect(!outcome.isAnswered && outcome.reason, 'only the server asked may answer').toBe(
      'timeout',
    );
  });

  it('closes its socket when no answer comes in time', async () => {
    // Arrange: a silent fake server; once the sockets of the tests before have finished
    // closing, the UDP sockets open now (the fake's own) are counted.
    const fakeServer = await startFakeNtpServer(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const socketsOpenBefore = countOpenUdpSockets();

    // Act: ask it once, and give the close a moment to finish.
    const outcome = await queryNtpServerOnce({
      server: fakeServer.ipv4Address,
      readLocalTimeMs: createLocalClockReadingInTurn([oneOClockOfTheEnduroMs]),
      timeoutMs: 50,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Assert: a timeout, and no socket left open by it.
    expect(!outcome.isAnswered && outcome.reason, 'nothing came back').toBe('timeout');
    expect(countOpenUdpSockets(), 'every poll would otherwise leak one socket').toBe(
      socketsOpenBefore,
    );
  });
});

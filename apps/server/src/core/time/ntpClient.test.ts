/**
 * The server's own SNTP client (apps/server)
 *
 * What this module is for:
 *   The server keeps real time from NTP (BAJAOVRLAY-62): the stream PC's VM and Windows
 *   both keep it badly. ntpClient.ts asks one NTP server once, over UDP, and works out
 *   how far the local clock is from the server's real time (the offset) and how long the
 *   question and answer spent on the network (the round trip), by the standard
 *   four-timestamp formula of RFC 4330.
 *
 * What these tests prove (against a fake NTP server on a real UDP socket of this machine,
 *   with the local clock's two readings given, so the maths is exact):
 *   - The question is a 48-byte NTP version 4 client packet carrying the local send time.
 *   - The offset and the round trip come out of the four timestamps as the formula says.
 *   - A local clock that is ahead gets a negative offset; a moment after February 2036
 *     (NTP's era 1) is read right.
 *   - The transmit timestamp's lowest bits are random, so an answer cannot be guessed.
 *
 * What these tests deliberately do not cover:
 *   - Several answers and servers, keeping the shortest round trip, and looking up a
 *     host name; ntpPolls.test.ts (the client is given an IPv4 address).
 *   - What comes back that is no answer; ntpClientRefusals.test.ts.
 *   - What the server clock does with an answer; serverClockDiscipline.test.ts.
 *   - A real NTP server on the internet: tests never leave this machine.
 */
import { describe, expect, it } from 'vitest';

import {
  buildAnswerOfAHealthyServer,
  createLocalClockReadingInTurn,
  startFakeNtpServer,
} from './fakeNtpServer.testSupport.js';
import { queryNtpServerOnce } from './ntpClient.js';

/** 10 October 2026, 13:00 UTC: the enduro is an hour in. */
const oneOClockOfTheEnduroMs = Date.parse('2026-10-10T13:00:00.000Z');

/** Long enough for an answer on this machine, short enough to keep the tests quick. */
const timeoutOfTheTestsMs = 300;

describe('one NTP question', () => {
  it('sends a 48-byte NTP version 4 client question carrying the local send time', async () => {
    // Arrange: a fake server that keeps the question it gets and answers nothing.
    const questionsReceived: Buffer[] = [];
    const fakeServer = await startFakeNtpServer((question) => {
      questionsReceived.push(question);
      return undefined;
    });

    // Act: ask it once at one o'clock local time.
    await queryNtpServerOnce({
      server: fakeServer.ipv4Address,
      readLocalTimeMs: createLocalClockReadingInTurn([oneOClockOfTheEnduroMs]),
      timeoutMs: timeoutOfTheTestsMs,
    });

    // Assert: one question, 48 bytes, version 4 in client mode, and in its transmit
    // timestamp the seconds since 1900 of one o'clock.
    const question = questionsReceived[0];
    expect(question?.length, 'an NTP question is 48 bytes').toBe(48);
    expect(question?.[0], 'leap 0, version 4, mode 3 (client) is 0x23').toBe(0x23);
    expect(
      question?.readUInt32BE(40),
      'the transmit timestamp must carry the send time, in seconds since 1900',
    ).toBe(oneOClockOfTheEnduroMs / 1000 + 2_208_988_800);
  });

  it('works out the offset and the round trip from the four timestamps', async () => {
    // Arrange: the local clock reads 13:00:00.000 at the send and 13:00:00.100 at the
    // arrival; the server got the question at 13:00:04.040 of real time and answered at
    // 13:00:04.050. So the local clock is about four seconds behind real time.
    const fakeServer = await startFakeNtpServer((question) =>
      buildAnswerOfAHealthyServer(question, {
        receivedAtMs: oneOClockOfTheEnduroMs + 4_040,
        sentAtMs: oneOClockOfTheEnduroMs + 4_050,
      }),
    );

    // Act: ask it once.
    const outcome = await queryNtpServerOnce({
      server: fakeServer.ipv4Address,
      readLocalTimeMs: createLocalClockReadingInTurn([
        oneOClockOfTheEnduroMs,
        oneOClockOfTheEnduroMs + 100,
      ]),
      timeoutMs: timeoutOfTheTestsMs,
    });

    // Assert: offset ((4040 − 0) + (4050 − 100)) / 2 = 3995 ms; round trip
    // (100 − 0) − (4050 − 4040) = 90 ms; the arrival as the local clock read it.
    if (!outcome.isAnswered) {
      throw new Error(`The fake server's answer was refused: ${outcome.reason}`);
    }
    expect(outcome.answer.offsetMs, 'real time minus local time, by the formula').toBeCloseTo(
      3_995,
      3,
    );
    expect(
      outcome.answer.roundTripMs,
      'the time on the network, without the time the server held it',
    ).toBeCloseTo(90, 3);
    expect(
      outcome.answer.localTimeAtArrivalMs,
      'the arrival is the second reading of the local clock',
    ).toBe(oneOClockOfTheEnduroMs + 100);
  });

  it('gives a negative offset when the local clock is ahead of real time', async () => {
    // Arrange: a local clock 1.275 s ahead, as João's WSL measured (offset −1.275 s),
    // with 20 ms each way on the network and 1 ms at the server.
    const fakeServer = await startFakeNtpServer((question) =>
      buildAnswerOfAHealthyServer(question, {
        receivedAtMs: oneOClockOfTheEnduroMs - 1_275 + 20,
        sentAtMs: oneOClockOfTheEnduroMs - 1_275 + 21,
      }),
    );

    // Act: ask it once; the local clock reads one o'clock, then 41 ms later.
    const outcome = await queryNtpServerOnce({
      server: fakeServer.ipv4Address,
      readLocalTimeMs: createLocalClockReadingInTurn([
        oneOClockOfTheEnduroMs,
        oneOClockOfTheEnduroMs + 41,
      ]),
      timeoutMs: timeoutOfTheTestsMs,
    });

    // Assert: −1275 ms, and a 40 ms round trip.
    if (!outcome.isAnswered) {
      throw new Error(`The fake server's answer was refused: ${outcome.reason}`);
    }
    expect(outcome.answer.offsetMs, 'a clock ahead of real time has a negative offset').toBeCloseTo(
      -1_275,
      3,
    );
    expect(outcome.answer.roundTripMs, '20 ms each way').toBeCloseTo(40, 3);
  });

  it('reads a moment after February 2036, when NTP counts its seconds from zero again', async () => {
    // Arrange: a local clock at noon on 1 June 2036; the server got the question 20 ms after
    // it left, by its clock 2 s ahead, and answered 1 ms later; the answer took 20 ms back.
    const noonOfJune2036Ms = Date.parse('2036-06-01T12:00:00.000Z');
    const fakeServer = await startFakeNtpServer((question) =>
      buildAnswerOfAHealthyServer(question, {
        receivedAtMs: noonOfJune2036Ms + 2_020,
        sentAtMs: noonOfJune2036Ms + 2_021,
      }),
    );

    // Act: ask it once; the local clock reads noon, then 41 ms later.
    const outcome = await queryNtpServerOnce({
      server: fakeServer.ipv4Address,
      readLocalTimeMs: createLocalClockReadingInTurn([noonOfJune2036Ms, noonOfJune2036Ms + 41]),
      timeoutMs: timeoutOfTheTestsMs,
    });

    // Assert: 2 s ahead and 40 ms on the network, as in any other year.
    if (!outcome.isAnswered) {
      throw new Error(`The fake server's answer was refused: ${outcome.reason}`);
    }
    expect(outcome.answer.offsetMs, 'era 1 is read as 2036, not 1900').toBeCloseTo(2_000, 3);
    expect(outcome.answer.roundTripMs, 'and the round trip as before').toBeCloseTo(40, 3);
  });

  it('puts random lowest bits in the transmit timestamp, so no one can guess the answer', async () => {
    // Arrange: a fake server that keeps every question and answers nothing.
    const questionsReceived: Buffer[] = [];
    const fakeServer = await startFakeNtpServer((question) => {
      questionsReceived.push(question);
      return undefined;
    });

    // Act: ask it eight times, each time at exactly one o'clock local time.
    for (let questionNumber = 1; questionNumber <= 8; questionNumber += 1) {
      await queryNtpServerOnce({
        server: fakeServer.ipv4Address,
        readLocalTimeMs: createLocalClockReadingInTurn([oneOClockOfTheEnduroMs]),
        timeoutMs: 50,
      });
    }

    // Assert: eight transmit timestamps, not all the same, each still one o'clock to within
    // a fiftieth of a millisecond (the random bits are the lowest sixteen).
    const transmitTimestamps = questionsReceived.map((question) =>
      question.subarray(40, 48).toString('hex'),
    );
    expect(new Set(transmitTimestamps).size, 'the lowest bits must differ').toBeGreaterThan(1);
    for (const question of questionsReceived) {
      const fractionMs = (question.readUInt32BE(44) / 2 ** 32) * 1000;
      expect(fractionMs, 'the random bits must not move the time sent').toBeLessThan(0.02);
    }
  });
});

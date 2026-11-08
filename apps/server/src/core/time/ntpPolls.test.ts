/**
 * One poll of the NTP servers (apps/server)
 *
 * What this module is for:
 *   Every 64 s the server clock asks NTP for real time (BAJAOVRLAY-62). One answer can be
 *   off by half of a delay that hit one way only, so a poll asks four times and keeps the
 *   answer with the shortest round trip. The servers come from BAJAOVRLAY_NTP_SERVERS, in
 *   order: a track-local server first, then NTP.br, then the pool. A server that gives
 *   nothing, or says not to ask it (a kiss of death), hands over to the next one.
 *
 * What these tests prove (against fake NTP servers on real UDP sockets of this machine):
 *   - Four questions to the first server, and the answer with the shortest round trip
 *     is the one kept, even when another came back with a 238 ms delay.
 *   - A silent first server hands over to the second, whose answer is kept and named.
 *   - A kiss of death stops the questions to that server at once.
 *   - With no server answering, the poll says so, naming each server's problem.
 *
 * What these tests deliberately do not cover:
 *   - The four timestamps of one answer; ntpClient.test.ts.
 *   - What the server clock does with the answer; serverClockDiscipline.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  buildAnswerOfAHealthyServer,
  buildKissOfDeathAnswer,
  createLocalClockReadingInTurn,
  startFakeNtpServer,
} from './fakeNtpServer.testSupport.js';
import { pollNtpServers } from './ntpPolls.js';

/** 10 October 2026, 13:00 UTC: the enduro is an hour in. */
const oneOClockOfTheEnduroMs = Date.parse('2026-10-10T13:00:00.000Z');

/** Long enough for an answer on this machine, short enough to keep the tests quick. */
const timeoutOfTheTestsMs = 200;

/**
 * A healthy server whose real time is the local clock's plus 2 s, that holds each
 * question 1 ms before answering.
 */
function answerAsAServerTwoSecondsAhead(question: Buffer): Buffer {
  const localSendMs = readTransmitTimeOfAQuestion(question);
  return buildAnswerOfAHealthyServer(question, {
    receivedAtMs: localSendMs + 2_000,
    sentAtMs: localSendMs + 2_001,
  });
}

/** The local send time a question carries, in ms since 1970 (whole seconds plus fraction). */
function readTransmitTimeOfAQuestion(question: Buffer): number {
  const secondsSince1900 = question.readUInt32BE(40);
  const fraction = question.readUInt32BE(44);
  return (secondsSince1900 - 2_208_988_800) * 1000 + Math.round((fraction / 2 ** 32) * 1000);
}

/**
 * The local clock across four questions, sent a second apart, whose answers took the
 * given round trips (each question reads it twice: when it leaves, when its answer comes).
 */
function createLocalClockForFourQuestions(roundTripsMs: readonly number[]): () => number {
  const readings = roundTripsMs.flatMap((roundTripMs, questionNumber) => {
    const sentAtMs = oneOClockOfTheEnduroMs + questionNumber * 1_000;
    return [sentAtMs, sentAtMs + roundTripMs];
  });
  return createLocalClockReadingInTurn(readings);
}

describe('one poll of the NTP servers', () => {
  it('asks four times and keeps the answer with the shortest round trip', async () => {
    // Arrange: one server; its four answers come back in 41, 13, 239 and 26 ms on the
    // local clock (40, 12, 238 and 25 ms on the network once the server's 1 ms is taken out).
    const fakeServer = await startFakeNtpServer(answerAsAServerTwoSecondsAhead);
    const readLocalTimeMs = createLocalClockForFourQuestions([41, 13, 239, 26]);

    // Act: poll it.
    const outcome = await pollNtpServers({
      servers: [fakeServer.address],
      readLocalTimeMs,
      timeoutPerQuestionMs: timeoutOfTheTestsMs,
    });

    // Assert: four questions, and the 12 ms answer kept.
    expect(fakeServer.countQuestionsReceived(), 'a poll asks four times').toBe(4);
    if (!outcome.isAnswered) {
      throw new Error(`The poll found no answer: ${outcome.problems.join('; ')}`);
    }
    expect(outcome.answer.roundTripMs, 'the shortest round trip is the one kept').toBeCloseTo(
      12,
      0,
    );
    expect(
      outcome.answer.localTimeAtArrivalMs,
      'the kept answer is the second, which arrived at 13:00:01.013',
    ).toBe(oneOClockOfTheEnduroMs + 1_013);
  });

  it('hands over to the next server when the first one says nothing', async () => {
    // Arrange: the track-local server is switched off; NTP.br's stand-in answers.
    const silentTrackServer = await startFakeNtpServer(() => undefined);
    const answeringServer = await startFakeNtpServer(answerAsAServerTwoSecondsAhead);
    const readLocalTimeMs = createLocalClockReadingInTurn(
      Array.from({ length: 16 }, (_, readingNumber) => oneOClockOfTheEnduroMs + readingNumber * 10),
    );

    // Act: poll the two, in order.
    const outcome = await pollNtpServers({
      servers: [silentTrackServer.address, answeringServer.address],
      readLocalTimeMs,
      timeoutPerQuestionMs: timeoutOfTheTestsMs,
    });

    // Assert: the silent one was asked, the second one's answer kept and named.
    expect(
      silentTrackServer.countQuestionsReceived(),
      'the first server is tried first',
    ).toBeGreaterThan(0);
    expect(outcome.isAnswered, 'the second server answered').toBe(true);
    expect(
      outcome.isAnswered && outcome.serverName,
      'the answer names the server it came from',
    ).toBe(`127.0.0.1:${answeringServer.address.port}`);
  });

  it('stops asking a server at once when it sends a kiss of death', async () => {
    // Arrange: a server that says RATE ("you ask too often"), and a healthy one after it.
    const rateLimitingServer = await startFakeNtpServer((question) =>
      buildKissOfDeathAnswer(question, 'RATE'),
    );
    const answeringServer = await startFakeNtpServer(answerAsAServerTwoSecondsAhead);
    const readLocalTimeMs = createLocalClockReadingInTurn(
      Array.from({ length: 16 }, (_, readingNumber) => oneOClockOfTheEnduroMs + readingNumber * 10),
    );

    // Act: poll the two.
    const outcome = await pollNtpServers({
      servers: [rateLimitingServer.address, answeringServer.address],
      readLocalTimeMs,
      timeoutPerQuestionMs: timeoutOfTheTestsMs,
    });

    // Assert: one question to the server that said RATE, and the answer from the other.
    expect(
      rateLimitingServer.countQuestionsReceived(),
      'a server that says not to ask is not asked again in the same poll',
    ).toBe(1);
    expect(outcome.isAnswered, 'the next server answered').toBe(true);
  });

  it('says that no server answered, naming each one and its problem', async () => {
    // Arrange: the uplink at the track is down: both servers are silent.
    const firstSilentServer = await startFakeNtpServer(() => undefined);
    const secondSilentServer = await startFakeNtpServer(() => undefined);
    const readLocalTimeMs = createLocalClockReadingInTurn([oneOClockOfTheEnduroMs]);

    // Act: poll the two.
    const outcome = await pollNtpServers({
      servers: [firstSilentServer.address, secondSilentServer.address],
      readLocalTimeMs,
      timeoutPerQuestionMs: timeoutOfTheTestsMs,
    });

    // Assert: no answer, and one problem per server, each naming the server.
    expect(outcome.isAnswered, 'nobody answered').toBe(false);
    expect(!outcome.isAnswered && outcome.problems, 'each server and why').toEqual([
      `127.0.0.1:${firstSilentServer.address.port}: timeout`,
      `127.0.0.1:${secondSilentServer.address.port}: timeout`,
    ]);
  });
});

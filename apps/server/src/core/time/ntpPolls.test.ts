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
 *   - Four questions to the first server, 2 s apart (public servers drop or refuse
 *     questions sent back to back), and the answer with the shortest round trip is the
 *     one kept, even when another came back with a 238 ms delay.
 *   - Asked for one question (the boot's quick poll), it asks once.
 *   - A host name is looked up once per poll, through DNS (not the system's getaddrinfo,
 *     which a dead uplink holds for seconds), and its address is asked; the next poll
 *     looks it up again; a name that cannot be looked up hands over to the next server.
 *   - A silent first server hands over to the second, whose answer is kept and named.
 *   - A server named to be asked last (the one a confirmation must not ask again) comes
 *     after the others.
 *   - A kiss of death stops the questions to that server at once; a RATE one says the
 *     poll was asked to slow down.
 *   - With no server answering, the poll says so, naming each server's problem.
 *
 * What these tests deliberately do not cover:
 *   - The four timestamps of one answer; ntpClient.test.ts.
 *   - What the server clock does with the answer; serverClockDiscipline.test.ts.
 *   - A poll stopped while under way; ntpStoppedMidPoll.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  buildAnswerOfAHealthyServer,
  buildKissOfDeathAnswer,
  createLocalClockReadingInTurn,
  startFakeNtpServer,
} from './fakeNtpServer.testSupport.js';
import type { LookUpIpv4Addresses } from './ipv4LookUpThroughCAres.js';
import { pollNtpServers } from './ntpPolls.js';

/** 10 October 2026, 13:00 UTC: the enduro is an hour in. */
const oneOClockOfTheEnduroMs = Date.parse('2026-10-10T13:00:00.000Z');

/** Long enough for an answer on this machine, short enough to keep the tests quick. */
const timeoutOfTheTestsMs = 200;

/** No waiting between questions, while each wait asked for is written down. */
function createWaitsThatPassAtOnce(): {
  waitBetweenQuestions: (waitMs: number) => Promise<void>;
  waitsAskedForMs: number[];
} {
  const waitsAskedForMs: number[] = [];
  return {
    waitBetweenQuestions: (waitMs) => {
      waitsAskedForMs.push(waitMs);
      return Promise.resolve();
    },
    waitsAskedForMs,
  };
}

/** A DNS that knows the names given, each with its one address, and no other name. */
function createDnsThatKnows(addressOfEachName: Record<string, string>): {
  lookUpIpv4Addresses: LookUpIpv4Addresses;
  namesLookedUp: string[];
} {
  const namesLookedUp: string[] = [];
  return {
    lookUpIpv4Addresses: (hostName) => {
      namesLookedUp.push(hostName);
      const address = addressOfEachName[hostName];
      if (address === undefined) {
        return Promise.reject(
          Object.assign(new Error(`queryA ENOTFOUND ${hostName}`), {
            code: 'ENOTFOUND',
          }),
        );
      }
      return Promise.resolve([address]);
    },
    namesLookedUp,
  };
}

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
    const { waitBetweenQuestions, waitsAskedForMs } = createWaitsThatPassAtOnce();

    // Act: poll it.
    const outcome = await pollNtpServers({
      servers: [fakeServer.address],
      readLocalTimeMs,
      timeoutPerQuestionMs: timeoutOfTheTestsMs,
      waitBetweenQuestions,
    });

    // Assert: four questions with 2 s between each, and the 12 ms answer kept.
    expect(fakeServer.countQuestionsReceived(), 'a poll asks four times').toBe(4);
    expect(waitsAskedForMs, 'NTP.br and the pool drop questions sent back to back').toEqual([
      2_000, 2_000, 2_000,
    ]);
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
      waitBetweenQuestions: createWaitsThatPassAtOnce().waitBetweenQuestions,
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
      waitBetweenQuestions: createWaitsThatPassAtOnce().waitBetweenQuestions,
    });

    // Assert: one question to the server that said RATE, and the answer from the other.
    expect(
      rateLimitingServer.countQuestionsReceived(),
      'a server that says not to ask is not asked again in the same poll',
    ).toBe(1);
    expect(outcome.isAnswered, 'the next server answered').toBe(true);
    expect(outcome.wasAskedToSlowDown, 'RATE asks the server clock to poll less often').toBe(true);
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
      waitBetweenQuestions: createWaitsThatPassAtOnce().waitBetweenQuestions,
    });

    // Assert: no answer, and one problem per server, each naming the server.
    expect(outcome.isAnswered, 'nobody answered').toBe(false);
    expect(!outcome.isAnswered && outcome.problems, 'each server and why').toEqual([
      `127.0.0.1:${firstSilentServer.address.port}: timeout`,
      `127.0.0.1:${secondSilentServer.address.port}: timeout`,
    ]);
  });

  it('asks once when one question is asked for, as the boot does', async () => {
    // Arrange: one healthy server.
    const fakeServer = await startFakeNtpServer(answerAsAServerTwoSecondsAhead);
    const { waitBetweenQuestions, waitsAskedForMs } = createWaitsThatPassAtOnce();

    // Act: poll it for one question.
    const outcome = await pollNtpServers({
      servers: [fakeServer.address],
      readLocalTimeMs: createLocalClockForFourQuestions([13]),
      timeoutPerQuestionMs: timeoutOfTheTestsMs,
      questionsPerServer: 1,
      waitBetweenQuestions,
    });

    // Assert: one question, no wait, an answer.
    expect(fakeServer.countQuestionsReceived(), 'the boot waits for one answer only').toBe(1);
    expect(waitsAskedForMs, 'and never waits between questions').toEqual([]);
    expect(outcome.isAnswered, 'the server answered').toBe(true);
  });

  it('looks a host name up once, through DNS, and asks the address it found', async () => {
    // Arrange: a server named as NTP.br's would be, which DNS finds on this machine.
    const fakeServer = await startFakeNtpServer(answerAsAServerTwoSecondsAhead);
    const dns = createDnsThatKnows({ 'a.st1.ntp.br': '127.0.0.1' });

    // Act: poll it by its name.
    const outcome = await pollNtpServers({
      servers: [{ host: 'a.st1.ntp.br', port: fakeServer.address.port }],
      readLocalTimeMs: createLocalClockForFourQuestions([41, 13, 239, 26]),
      timeoutPerQuestionMs: timeoutOfTheTestsMs,
      waitBetweenQuestions: createWaitsThatPassAtOnce().waitBetweenQuestions,
      lookUpIpv4Addresses: dns.lookUpIpv4Addresses,
    });

    // Assert: one look-up for the four questions, and the answer named by the host name.
    expect(dns.namesLookedUp, 'once per poll, not once per question').toEqual(['a.st1.ntp.br']);
    expect(fakeServer.countQuestionsReceived(), 'the address found was asked').toBe(4);
    expect(outcome.isAnswered && outcome.serverName, 'named as the settings name it').toBe(
      `a.st1.ntp.br:${fakeServer.address.port}`,
    );
  });

  it('looks the name up again at the next poll, so a changed address is followed', async () => {
    // Arrange: a server named as NTP.br's would be, which DNS finds on this machine.
    const fakeServer = await startFakeNtpServer(answerAsAServerTwoSecondsAhead);
    const dns = createDnsThatKnows({ 'a.st1.ntp.br': '127.0.0.1' });
    function pollTheServerByItsName() {
      return pollNtpServers({
        servers: [{ host: 'a.st1.ntp.br', port: fakeServer.address.port }],
        readLocalTimeMs: createLocalClockForFourQuestions([13]),
        timeoutPerQuestionMs: timeoutOfTheTestsMs,
        questionsPerServer: 1,
        lookUpIpv4Addresses: dns.lookUpIpv4Addresses,
      });
    }

    // Act: two polls, as 64 s apart.
    await pollTheServerByItsName();
    await pollTheServerByItsName();

    // Assert: one look-up per poll: a pool name's address changes over a race day, and an
    // address kept from the boot would go on asking a server that has left the pool.
    expect(dns.namesLookedUp, 'each poll looks the name up afresh').toEqual([
      'a.st1.ntp.br',
      'a.st1.ntp.br',
    ]);
  });

  it('hands over to the next server when a name cannot be looked up', async () => {
    // Arrange: a track-local server whose name DNS does not know, then a healthy one.
    const answeringServer = await startFakeNtpServer(answerAsAServerTwoSecondsAhead);
    const dns = createDnsThatKnows({});

    // Act: poll the two.
    const outcome = await pollNtpServers({
      servers: [{ host: 'ntp.pista.local', port: 123 }, answeringServer.address],
      readLocalTimeMs: createLocalClockForFourQuestions([41, 13, 239, 26]),
      timeoutPerQuestionMs: timeoutOfTheTestsMs,
      waitBetweenQuestions: createWaitsThatPassAtOnce().waitBetweenQuestions,
      lookUpIpv4Addresses: dns.lookUpIpv4Addresses,
    });

    // Assert: the name was looked up, and the second server answered.
    expect(dns.namesLookedUp, 'the track-local name was tried first').toEqual(['ntp.pista.local']);
    expect(outcome.isAnswered, 'the next server answered').toBe(true);
  });

  it('names the failed look-up when no other server answers', async () => {
    // Arrange: only the track-local server, whose name DNS does not know.
    const dns = createDnsThatKnows({});

    // Act: poll it.
    const outcome = await pollNtpServers({
      servers: [{ host: 'ntp.pista.local', port: 123 }],
      readLocalTimeMs: createLocalClockReadingInTurn([oneOClockOfTheEnduroMs]),
      lookUpIpv4Addresses: dns.lookUpIpv4Addresses,
    });

    // Assert: no answer, and the log line says DNS did not know the name.
    expect(!outcome.isAnswered && outcome.problems, 'the server and why').toEqual([
      'ntp.pista.local:123: dns (ENOTFOUND)',
    ]);
  });

  it('asks the server named to be asked last after the others, as a confirmation does', async () => {
    // Arrange: two healthy servers; the first one gave the answer to be confirmed.
    const firstServer = await startFakeNtpServer(answerAsAServerTwoSecondsAhead);
    const secondServer = await startFakeNtpServer(answerAsAServerTwoSecondsAhead);
    const nameOfTheFirstServer = `127.0.0.1:${firstServer.address.port}`;

    // Act: poll the two, the first one to be asked last.
    const outcome = await pollNtpServers({
      servers: [firstServer.address, secondServer.address],
      readLocalTimeMs: createLocalClockForFourQuestions([41, 13, 239, 26]),
      timeoutPerQuestionMs: timeoutOfTheTestsMs,
      waitBetweenQuestions: createWaitsThatPassAtOnce().waitBetweenQuestions,
      serverToAskLast: nameOfTheFirstServer,
    });

    // Assert: the second server answered; the first one was not asked.
    expect(outcome.isAnswered && outcome.serverName, 'a second opinion').toBe(
      `127.0.0.1:${secondServer.address.port}`,
    );
    expect(firstServer.countQuestionsReceived(), 'the first server is not asked again').toBe(0);
  });
});

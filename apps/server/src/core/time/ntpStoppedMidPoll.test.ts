/**
 * A poll of NTP stopped while it is under way (apps/server)
 *
 * What this module is for:
 *   The server clock's discipline (serverClockDiscipline.ts, BAJAOVRLAY-62) polls NTP over
 *   UDP: a question waits up to a second for its answer, and a poll pauses 2 s between
 *   questions. When the server stops (a test closing it, Ctrl+C), stop() must end the
 *   poll in flight there and then: a socket left open, or a question sent after the stop,
 *   keeps the process busy and reaches a public server for nothing. stop() aborts a
 *   signal that goes through the poll and its waits into each question.
 *
 * What these tests prove (against fake NTP servers on real UDP sockets of this machine,
 * on real time):
 *   - One question aborted while it waits for its answer ends at once, says 'aborted',
 *     and closes its socket.
 *   - A poll aborted in its 2 s pause between two questions ends at once and asks no
 *     further question.
 *   - stop() during the boot's poll closes its socket, ends the boot at once, and the
 *     next server is never asked.
 *
 * What these tests deliberately do not cover:
 *   - A DNS look-up in flight: it is left to end on its own (2 s at most, and no socket
 *     of the poll's), and the poll stops right after it; ntpPolls.ts says why.
 *   - stop() between two polls: it clears the timer of the next one; the discipline's
 *     fake-world tests stop every discipline they start.
 */
import { describe, expect, it, vi } from 'vitest';

import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import {
  buildAnswerOfAHealthyServer,
  countOpenUdpSockets,
  startFakeNtpServer,
} from './fakeNtpServer.testSupport.js';
import { queryNtpServerOnce } from './ntpClient.js';
import { pollNtpServers } from './ntpPolls.js';
import { createServerClock } from './serverClock.js';
import { startServerClockDiscipline } from './serverClockDiscipline.js';

/** Lets the sockets closed just before finish closing, so a count of them is settled. */
function letClosedSocketsFinishClosing(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

/** A healthy server that answers on this machine's own clock, 1 ms after the question. */
function answerOnThisMachinesClock(question: Buffer): Buffer {
  const nowMs = Date.now();
  return buildAnswerOfAHealthyServer(question, { receivedAtMs: nowMs, sentAtMs: nowMs + 1 });
}

describe('one question, aborted', () => {
  it('ends at once while it waits for its answer, and closes its socket', async () => {
    // Arrange: a silent server (the uplink is down), and the sockets open now counted.
    const silentServer = await startFakeNtpServer(() => undefined);
    await letClosedSocketsFinishClosing();
    const socketsOpenBefore = countOpenUdpSockets();
    const stopController = new AbortController();

    // Act: ask it, with five seconds to answer; once the question has reached it, abort.
    const startedAtMs = Date.now();
    const question = queryNtpServerOnce({
      server: silentServer.ipv4Address,
      readLocalTimeMs: () => Date.now(),
      timeoutMs: 5_000,
      abortSignal: stopController.signal,
    });
    await vi.waitFor(() => expect(silentServer.countQuestionsReceived()).toBe(1));
    stopController.abort();
    const outcome = await question;
    const tookMs = Date.now() - startedAtMs;
    await letClosedSocketsFinishClosing();

    // Assert: 'aborted', long before the five seconds, and no socket left open.
    expect(!outcome.isAnswered && outcome.reason, 'the question says why it ended').toBe('aborted');
    expect(tookMs, 'the abort ends the wait, not the timeout').toBeLessThan(1_000);
    expect(countOpenUdpSockets(), 'the socket is closed when the question is aborted').toBe(
      socketsOpenBefore,
    );
  });
});

describe('one poll, aborted', () => {
  it('ends at once in its pause between two questions and asks nothing more', async () => {
    // Arrange: a healthy server; the local clock is read twice per question (sent,
    // answered), so two readings mean the first answer is in and the 2 s pause begins.
    const answeringServer = await startFakeNtpServer(answerOnThisMachinesClock);
    let localClockReadings = 0;
    const stopController = new AbortController();

    // Act: poll it for four questions; abort once the first answer is in.
    const startedAtMs = Date.now();
    const poll = pollNtpServers({
      servers: [answeringServer.address],
      readLocalTimeMs: () => {
        localClockReadings += 1;
        return Date.now();
      },
      questionsPerServer: 4,
      abortSignal: stopController.signal,
    });
    await vi.waitFor(() => expect(localClockReadings).toBe(2));
    stopController.abort();
    const outcome = await poll;
    const tookMs = Date.now() - startedAtMs;

    // Assert: over well before the 2 s pause would have ended, after one question only,
    // and with no answer handed to a discipline that has stopped.
    expect(tookMs, 'the abort ends the pause').toBeLessThan(1_500);
    expect(answeringServer.countQuestionsReceived(), 'no question after the abort').toBe(1);
    expect(outcome.isAnswered, 'a stopped poll gives no answer').toBe(false);
  });
});

describe("the discipline's stop() during the boot's poll", () => {
  it('closes the socket, ends the boot at once, and never asks the next server', async () => {
    // Arrange: two silent servers (without a stop, the first times out after 1 s and the
    // second is asked); a server clock and its discipline polling them for real.
    const firstSilentServer = await startFakeNtpServer(() => undefined);
    const secondSilentServer = await startFakeNtpServer(() => undefined);
    const serverClock = createServerClock();
    const discipline = startServerClockDiscipline({
      serverClock,
      pollForRealTime: (request, abortSignal) =>
        pollNtpServers({
          servers: [firstSilentServer.address, secondSilentServer.address],
          readLocalTimeMs: serverClock.readMonotonicTimeMs,
          questionsPerServer: request.questionsPerServer,
          serverToAskLast: request.serverToAskLast,
          abortSignal,
        }),
      isAnythingCountingTimeOnAir: () => false,
      logger: createRecordingLogger().logger,
    });
    await letClosedSocketsFinishClosing();
    const socketsOpenBefore = countOpenUdpSockets();

    // Act: the boot asks the first server; while it waits, the server stops. Then more
    // than the question's second passes.
    const startedAtMs = Date.now();
    const boot = discipline.stepToRealTimeAtBoot();
    await vi.waitFor(() => expect(firstSilentServer.countQuestionsReceived()).toBe(1));
    discipline.stop();
    await boot;
    const bootTookMs = Date.now() - startedAtMs;
    await letClosedSocketsFinishClosing();
    const socketsOpenAfterTheStop = countOpenUdpSockets();
    await new Promise((resolve) => setTimeout(resolve, 1_200));

    // Assert: the boot ended at once (not after its 3 s), its socket is closed, and the
    // second server never heard from a stopped server.
    expect(bootTookMs, 'the stop ends the boot’s wait').toBeLessThan(1_000);
    expect(socketsOpenAfterTheStop, 'the question’s socket is closed by the stop').toBe(
      socketsOpenBefore,
    );
    expect(secondSilentServer.countQuestionsReceived(), 'nothing is sent after the stop').toBe(0);
  });
});

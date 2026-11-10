// Test support: the fake NTP server of openFakeNtpServer.testSupport.ts, for Vitest tests:
// each call starts a fresh server, and the test stops it when it ends. The answers a test
// gives it are built there too, and passed on from here.
import { onTestFinished } from 'vitest';

import {
  type AnswerToAQuestion,
  type FakeNtpServer,
  openFakeNtpServer,
} from './openFakeNtpServer.testSupport.js';

export {
  buildAnswerOfAHealthyServer,
  buildAnswerOfAServerWithoutItsTime,
  buildAnswerWithAZeroTimestamp,
  buildKissOfDeathAnswer,
  buildMalformedAnswer,
  countOpenUdpSockets,
  createLocalClockReadingInTurn,
  type FakeNtpServer,
} from './openFakeNtpServer.testSupport.js';

/**
 * Starts a fake NTP server answering every question with `answerQuestion`, and stops it
 * when the test ends.
 */
export async function startFakeNtpServer(
  answerQuestion: AnswerToAQuestion,
): Promise<FakeNtpServer> {
  const fakeNtpServer = await openFakeNtpServer(answerQuestion);
  onTestFinished(() => {
    fakeNtpServer.closeForGood();
  });
  return fakeNtpServer;
}

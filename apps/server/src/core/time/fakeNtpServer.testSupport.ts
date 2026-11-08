// Test support: a fake NTP server on a real UDP socket of this machine (127.0.0.1, a free
// port), which answers each question the way a test tells it to. Its packets are built
// here with their own arithmetic, not with ntpClient.ts's, so a mistake in the client's
// conversion cannot hide behind the same mistake in the fake.
// Each call starts a fresh server; the test stops it when it ends.
import { createSocket } from 'node:dgram';

import { onTestFinished } from 'vitest';

import type { NtpServerAddress } from './ntpClient.js';

/** Seconds from 1 January 1900 (where NTP counts from) to 1 January 1970. */
const secondsFrom1900To1970 = 2_208_988_800;

/** What the fake does with one question: the bytes to send back, or nothing at all. */
type AnswerToAQuestion = (question: Buffer) => Buffer | undefined;

/** A running fake NTP server: where to ask it, and how many questions it has had. */
export type FakeNtpServer = {
  address: NtpServerAddress;
  countQuestionsReceived: () => number;
};

/**
 * Starts a fake NTP server answering every question with `answerQuestion`, and stops it
 * when the test ends.
 */
export async function startFakeNtpServer(
  answerQuestion: AnswerToAQuestion,
): Promise<FakeNtpServer> {
  const socket = createSocket('udp4');
  let questionsReceived = 0;
  socket.on('message', (question, sender) => {
    questionsReceived += 1;
    const answer = answerQuestion(question);
    if (answer !== undefined) {
      socket.send(answer, sender.port, sender.address);
    }
  });
  await new Promise<void>((resolve) => socket.bind(0, '127.0.0.1', resolve));
  onTestFinished(() => {
    socket.close();
  });
  return {
    address: { host: '127.0.0.1', port: socket.address().port },
    countQuestionsReceived: () => questionsReceived,
  };
}

/** Writes a moment (ms since 1970) as an NTP timestamp at a position of a packet. */
function writeNtpTimestamp(packet: Buffer, position: number, momentMs: number): void {
  const wholeSeconds = Math.floor(momentMs / 1000);
  const millisecondsPastTheSecond = momentMs - wholeSeconds * 1000;
  packet.writeUInt32BE(wholeSeconds + secondsFrom1900To1970, position);
  packet.writeUInt32BE(Math.round((millisecondsPastTheSecond / 1000) * 2 ** 32), position + 4);
}

/**
 * The answer of a healthy stratum-2 server (such as a.st1.ntp.br's pool): it got the
 * question at `receivedAtMs` and sent the answer at `sentAtMs`, both its own real time.
 * It echoes the question's transmit timestamp as its originate timestamp, as NTP does.
 */
export function buildAnswerOfAHealthyServer(
  question: Buffer,
  moments: { receivedAtMs: number; sentAtMs: number },
): Buffer {
  const answer = Buffer.alloc(48);
  // Leap indicator 0 (no warning), version 4, mode 4 (server).
  answer[0] = (0 << 6) | (4 << 3) | 4;
  answer[1] = 2;
  question.copy(answer, 24, 40, 48);
  writeNtpTimestamp(answer, 32, moments.receivedAtMs);
  writeNtpTimestamp(answer, 40, moments.sentAtMs);
  return answer;
}

/**
 * A kiss-of-death answer (stratum 0) with its four-letter code, such as RATE ("you ask
 * too often") or DENY ("you may not ask"): the server says not to use it.
 */
export function buildKissOfDeathAnswer(question: Buffer, code: string): Buffer {
  const answer = Buffer.alloc(48);
  answer[0] = (0 << 6) | (4 << 3) | 4;
  answer[1] = 0;
  answer.write(code, 12, 'ascii');
  question.copy(answer, 24, 40, 48);
  return answer;
}

/** Eleven bytes of noise where 48 were due: what a broken middlebox might send back. */
export function buildMalformedAnswer(): Buffer {
  return Buffer.from('não é ntp!', 'utf8');
}

/**
 * The local clock a client reads, as a list of readings: the first when it sends the
 * question, the second when the answer arrives. A known pair makes the maths exact.
 */
export function createLocalClockReadingInTurn(readingsMs: readonly number[]): () => number {
  let readingsTaken = 0;
  return () => {
    const reading = readingsMs[Math.min(readingsTaken, readingsMs.length - 1)];
    readingsTaken += 1;
    if (reading === undefined) {
      throw new Error('The local clock was given no readings.');
    }
    return reading;
  };
}

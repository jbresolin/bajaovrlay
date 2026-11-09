// Test support: a fake NTP server on a real UDP socket of this machine (127.0.0.1, a free
// port), which answers each question the way a test tells it to. Its packets are built
// here with their own arithmetic, not with ntpClient.ts's, so a mistake in the client's
// conversion cannot hide behind the same mistake in the fake.
// Each call starts a fresh server; the test stops it when it ends.
import { createSocket, type RemoteInfo } from 'node:dgram';

import { onTestFinished } from 'vitest';

import type { NtpServerAddress, NtpServerIpv4Address } from './ntpClient.js';

/** Seconds from 1 January 1900 (where NTP counts from) to 1 January 1970. */
const secondsFrom1900To1970 = 2_208_988_800;

/**
 * What the fake does with one question (and who sent it): the packets to send back, in
 * order, or nothing at all.
 */
type AnswerToAQuestion = (
  question: Buffer,
  sender: RemoteInfo,
) => Buffer | readonly Buffer[] | undefined;

/** A running fake NTP server: where to ask it, and how many questions it has had. */
export type FakeNtpServer = {
  /** As BAJAOVRLAY_NTP_SERVERS would name it, for a poll. */
  address: NtpServerAddress;
  /** As the client asks it, once a poll has looked the name up. */
  ipv4Address: NtpServerIpv4Address;
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
    const answer = answerQuestion(question, sender);
    const packetsToSend = answer === undefined ? [] : [answer].flat();
    for (const packet of packetsToSend) {
      socket.send(packet, sender.port, sender.address);
    }
  });
  await new Promise<void>((resolve) => socket.bind(0, '127.0.0.1', resolve));
  onTestFinished(() => {
    socket.close();
  });
  return {
    address: { host: '127.0.0.1', port: socket.address().port },
    ipv4Address: { ipv4Address: '127.0.0.1', port: socket.address().port },
    countQuestionsReceived: () => questionsReceived,
  };
}

/** Writes a moment (ms since 1970) as an NTP timestamp at a position of a packet. */
function writeNtpTimestamp(packet: Buffer, position: number, momentMs: number): void {
  const wholeSeconds = Math.floor(momentMs / 1000);
  const millisecondsPastTheSecond = momentMs - wholeSeconds * 1000;
  // Modulo 2^32: from February 2036 NTP's seconds start again from zero (era 1).
  packet.writeUInt32BE((wholeSeconds + secondsFrom1900To1970) % 2 ** 32, position);
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

/**
 * The answer of a server that has lost its own time, as a track-side NTP box without a GPS
 * fix sends: leap indicator 3 ("not synchronized"), or stratum 16 ("unsynchronized"). Its
 * timestamps are plausible; it is the header that says not to use them.
 */
export function buildAnswerOfAServerWithoutItsTime(
  question: Buffer,
  howItSaysSo: 'leapIndicator3' | 'stratum16',
): Buffer {
  const answer = buildAnswerOfAHealthyServer(question, {
    receivedAtMs: Date.parse('2026-10-10T13:00:00.000Z'),
    sentAtMs: Date.parse('2026-10-10T13:00:00.001Z'),
  });
  if (howItSaysSo === 'leapIndicator3') {
    answer[0] = (3 << 6) | (4 << 3) | 4;
  } else {
    answer[1] = 16;
  }
  return answer;
}

/**
 * A healthy-looking answer with one timestamp left at zero, which RFC 4330 says a client
 * must refuse. Read naively, zero is February 2036 (era 1): a step of ten years.
 */
export function buildAnswerWithAZeroTimestamp(
  question: Buffer,
  timestampLeftAtZero: 'receive' | 'transmit',
): Buffer {
  const answer = buildAnswerOfAHealthyServer(question, {
    receivedAtMs: Date.parse('2026-10-10T13:00:00.000Z'),
    sentAtMs: Date.parse('2026-10-10T13:00:00.001Z'),
  });
  const position = timestampLeftAtZero === 'receive' ? 32 : 40;
  answer.fill(0, position, position + 8);
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

/** How many UDP sockets this process holds open now: the fakes' and any question's. */
export function countOpenUdpSockets(): number {
  return process.getActiveResourcesInfo().filter((resource) => resource === 'UDPWrap').length;
}

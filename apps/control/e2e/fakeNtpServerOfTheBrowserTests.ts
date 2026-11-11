// Test support: an NTP server of a browser test's own, on a UDP port of this machine
// (127.0.0.1), whose "real time" is the machine's clock moved by as much as the test says.
// A server started with BAJAOVRLAY_NTP_SERVERS=127.0.0.1:<port> keeps its clock on it, so a
// test moves the server's clock forwards for real (BAJAOVRLAY-64): the time moves on, then
// "Acertar relógio agora" steps the server clock to it, as on the stream PC. Its packets are
// the healthy stratum-2 answer the server's own fakeNtpServer.testSupport.ts builds,
// written here again since that file needs Vitest.
import { createSocket } from 'node:dgram';

/** Seconds from 1 January 1900 (where NTP counts from) to 1 January 1970. */
const secondsFrom1900To1970 = 2_208_988_800;

/** A running fake NTP server: where to point the server, and the one thing a test changes. */
export type FakeNtpServerOfATest = {
  /** As BAJAOVRLAY_NTP_SERVERS names it: `127.0.0.1:<port>`. */
  address: string;
  /** From now on, real time is the machine's clock plus this many ms (minus: behind). */
  setRealTimeAheadOfTheMachineBy: (milliseconds: number) => void;
  stop: () => void;
};

/** Writes a moment (ms since 1970) as an NTP timestamp at a position of a packet. */
function writeNtpTimestamp(packet: Buffer, position: number, momentMs: number): void {
  const wholeSeconds = Math.floor(momentMs / 1000);
  const millisecondsPastTheSecond = momentMs - wholeSeconds * 1000;
  packet.writeUInt32BE((wholeSeconds + secondsFrom1900To1970) % 2 ** 32, position);
  packet.writeUInt32BE(Math.round((millisecondsPastTheSecond / 1000) * 2 ** 32), position + 4);
}

/**
 * The answer of a healthy stratum-2 server that got the question and sent the answer at
 * `realTimeMs`. It echoes the question's transmit timestamp as its originate timestamp.
 */
function buildAnswerAtRealTime(question: Buffer, realTimeMs: number): Buffer {
  const answer = Buffer.alloc(48);
  // Leap indicator 0 (no warning), version 4, mode 4 (server).
  answer[0] = (0 << 6) | (4 << 3) | 4;
  answer[1] = 2;
  question.copy(answer, 24, 40, 48);
  writeNtpTimestamp(answer, 32, realTimeMs);
  writeNtpTimestamp(answer, 40, realTimeMs);
  return answer;
}

/** Starts the fake NTP server on a free port; real time starts as the machine's clock. */
export async function startFakeNtpServerOfATest(): Promise<FakeNtpServerOfATest> {
  const socket = createSocket('udp4');
  let realTimeAheadByMs = 0;
  socket.on('message', (question, sender) => {
    const answer = buildAnswerAtRealTime(question, Date.now() + realTimeAheadByMs);
    socket.send(answer, sender.port, sender.address);
  });
  await new Promise<void>((resolve) => socket.bind(0, '127.0.0.1', resolve));
  return {
    address: `127.0.0.1:${String(socket.address().port)}`,
    setRealTimeAheadOfTheMachineBy: (milliseconds) => {
      realTimeAheadByMs = milliseconds;
    },
    stop: () => {
      socket.close();
    },
  };
}

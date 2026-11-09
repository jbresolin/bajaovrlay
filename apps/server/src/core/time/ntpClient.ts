/**
 * The server's own SNTP client (RFC 4330): one question to one NTP server over UDP, and
 * from the answer how far the local clock is from real time. No dependency on purpose:
 * it is one packet each way, and the server's clock rests on it (BAJAOVRLAY-62).
 *
 * The four timestamps: t1 the local clock when the question left, t2 the server's real
 * time when it arrived there, t3 the server's real time when the answer left, t4 the
 * local clock when the answer arrived. Then
 *   offset     = ((t2 − t1) + (t3 − t4)) / 2   (real time minus local time)
 *   round trip = (t4 − t1) − (t3 − t2)         (time on the network, both ways)
 * What could go wrong: the formula assumes the two ways took as long as each other; a
 * one-sided delay of d makes the offset wrong by up to d / 2. That is why a poll asks
 * several times and keeps the shortest round trip (ntpPolls.ts).
 */
import { randomInt } from 'node:crypto';
import { createSocket } from 'node:dgram';

/** One NTP server: a host name or IPv4 address, and its UDP port (123 unless given). */
export type NtpServerAddress = { host: string; port: number };

/** One NTP server as asked: its IPv4 address (ntpPolls.ts looks the name up), and its port. */
export type NtpServerIpv4Address = { ipv4Address: string; port: number };

/** A usable answer: the offset, the round trip, and when it arrived on the local clock. */
export type NtpAnswer = {
  /** Real time minus local time, in ms; negative when the local clock is ahead. */
  offsetMs: number;
  /** Time spent on the network both ways, in ms. */
  roundTripMs: number;
  /** The local clock when the answer arrived (t4). */
  localTimeAtArrivalMs: number;
};

/** Why a question gave no usable answer ('aborted': the server clock's discipline stopped). */
export type NtpRefusalReason =
  'timeout' | 'unreachable' | 'malformed' | 'unsynchronized' | 'kissOfDeath' | 'aborted';

/** One question's outcome: an answer, or why there is none (with a detail for the log). */
export type NtpQueryOutcome =
  | { isAnswered: true; answer: NtpAnswer }
  | { isAnswered: false; reason: NtpRefusalReason; detail?: string };

/** Seconds from 1 January 1900 (where NTP counts from) to 1 January 1970. */
const secondsFrom1900To1970 = 2_208_988_800;

/** An NTP packet without extensions: what is sent, and the least an answer may be. */
const ntpPacketLength = 48;

/** Where the packet keeps each timestamp, in bytes from its start. */
const originateTimestampPosition = 24;
const receiveTimestampPosition = 32;
const transmitTimestampPosition = 40;

/**
 * Asks one NTP server once, at its IPv4 address. `readLocalTimeMs` is the clock being
 * measured (the server passes its monotonic time); it is read right before the question
 * leaves and as soon as the answer arrives. Never rejects: every failure is an outcome
 * with its reason.
 * The socket is connected to the server, so the system drops a packet from any other
 * address; a packet from the server that is not an answer to this question (malformed, or
 * a late answer to an earlier one) is set aside and the wait goes on to the timeout, so a
 * stray datagram cannot cancel a good exchange. `abortSignal` (the discipline's stop)
 * ends the question at once. The socket is closed and the timer cleared however it ends.
 */
export function queryNtpServerOnce(options: {
  server: NtpServerIpv4Address;
  readLocalTimeMs: () => number;
  timeoutMs: number;
  abortSignal?: AbortSignal | undefined;
}): Promise<NtpQueryOutcome> {
  const { server, readLocalTimeMs, timeoutMs, abortSignal } = options;
  if (abortSignal?.aborted === true) {
    return Promise.resolve({ isAnswered: false, reason: 'aborted' });
  }
  return new Promise((resolve) => {
    const socket = createSocket('udp4');
    let isFinished = false;
    // What the last packet set aside was, so a timeout after one says so.
    let packetSetAside: string | undefined;
    function finish(outcome: NtpQueryOutcome): void {
      if (isFinished) {
        return;
      }
      isFinished = true;
      clearTimeout(timeoutHandle);
      abortSignal?.removeEventListener('abort', finishAsAborted);
      socket.close();
      resolve(outcome);
    }
    function finishAsAborted(): void {
      finish({ isAnswered: false, reason: 'aborted' });
    }
    abortSignal?.addEventListener('abort', finishAsAborted, { once: true });

    const timeoutHandle = setTimeout(() => {
      if (packetSetAside === undefined) {
        finish({ isAnswered: false, reason: 'timeout' });
        return;
      }
      finish({ isAnswered: false, reason: 'malformed', detail: packetSetAside });
    }, timeoutMs);
    socket.on('error', (socketError) =>
      finish({ isAnswered: false, reason: 'unreachable', detail: socketError.message }),
    );
    let sentAtLocalMs = 0;
    let question: Buffer = Buffer.alloc(0);
    socket.on('message', (answerPacket) => {
      const arrivedAtLocalMs = readLocalTimeMs();
      const whyItIsNoAnswer = findWhyAPacketAnswersNothing(answerPacket, question);
      if (whyItIsNoAnswer !== undefined) {
        packetSetAside = whyItIsNoAnswer;
        return;
      }
      finish(readNtpAnswer(answerPacket, sentAtLocalMs, arrivedAtLocalMs));
    });
    socket.connect(server.port, server.ipv4Address, () => {
      // Aborted while connecting: the socket is closed, and sending on it would throw.
      if (isFinished) {
        return;
      }
      sentAtLocalMs = readLocalTimeMs();
      question = buildNtpQuestion(sentAtLocalMs);
      socket.send(question, (sendError) => {
        if (sendError !== null) {
          finish({ isAnswered: false, reason: 'unreachable', detail: sendError.message });
        }
      });
    });
  });
}

/**
 * A client question: version 4, mode 3, the send time as its transmit timestamp. Its
 * lowest 16 bits (under 16 µs) are random, as RFC 5905 advises, so that only someone who
 * saw the question can answer it.
 */
function buildNtpQuestion(sentAtLocalMs: number): Buffer {
  const question = Buffer.alloc(ntpPacketLength);
  // Leap indicator 0, version 4, mode 3 (client): 00 100 011.
  question[0] = 0x23;
  writeNtpTimestamp(question, transmitTimestampPosition, sentAtLocalMs);
  question.writeUInt16BE(randomInt(0, 2 ** 16), transmitTimestampPosition + 6);
  return question;
}

/**
 * Why a packet from the server answers nothing of this question (too short, not a
 * server's answer, or not echoing this question's transmit timestamp), or undefined when
 * it is the answer.
 */
function findWhyAPacketAnswersNothing(answerPacket: Buffer, question: Buffer): string | undefined {
  if (answerPacket.length < ntpPacketLength) {
    return `${answerPacket.length} bytes`;
  }
  const mode = (answerPacket[0] ?? 0) & 0b111;
  if (mode !== 4) {
    return `mode ${mode}`;
  }
  const echoedTimestamp = answerPacket.subarray(
    originateTimestampPosition,
    originateTimestampPosition + 8,
  );
  const ourTimestamp = question.subarray(transmitTimestampPosition, transmitTimestampPosition + 8);
  if (!echoedTimestamp.equals(ourTimestamp)) {
    return 'not an answer to this question';
  }
  return undefined;
}

/** Reads the server's answer to this question: refused when it says not to use it. */
function readNtpAnswer(
  answerPacket: Buffer,
  sentAtLocalMs: number,
  arrivedAtLocalMs: number,
): NtpQueryOutcome {
  const leapIndicator = (answerPacket[0] ?? 0) >> 6;
  const stratum = answerPacket[1] ?? 0;
  if (stratum === 0) {
    // A kiss of death: the four letters say why (RATE, DENY, RSTR...).
    const code = answerPacket.toString('ascii', 12, 16).replace(/\0/g, '');
    return { isAnswered: false, reason: 'kissOfDeath', detail: code };
  }
  if (leapIndicator === 3 || stratum >= 16) {
    return { isAnswered: false, reason: 'unsynchronized', detail: `stratum ${stratum}` };
  }
  // RFC 4330: a zero receive or transmit timestamp must be refused. Read as a moment it
  // is February 2036, and a box that sends it would step the clock by years.
  if (isAZeroTimestamp(answerPacket, receiveTimestampPosition)) {
    return { isAnswered: false, reason: 'unsynchronized', detail: 'zero receive timestamp' };
  }
  if (isAZeroTimestamp(answerPacket, transmitTimestampPosition)) {
    return { isAnswered: false, reason: 'unsynchronized', detail: 'zero transmit timestamp' };
  }
  const receivedAtServerMs = readNtpTimestamp(answerPacket, receiveTimestampPosition);
  const sentAtServerMs = readNtpTimestamp(answerPacket, transmitTimestampPosition);
  const offsetMs = (receivedAtServerMs - sentAtLocalMs + (sentAtServerMs - arrivedAtLocalMs)) / 2;
  const roundTripMs = arrivedAtLocalMs - sentAtLocalMs - (sentAtServerMs - receivedAtServerMs);
  return {
    isAnswered: true,
    answer: { offsetMs, roundTripMs, localTimeAtArrivalMs: arrivedAtLocalMs },
  };
}

/** Whether all eight bytes of a timestamp are zero. */
function isAZeroTimestamp(packet: Buffer, position: number): boolean {
  return packet.readUInt32BE(position) === 0 && packet.readUInt32BE(position + 4) === 0;
}

/** Writes ms since 1970 as an NTP timestamp: seconds since 1900, then the fraction. */
function writeNtpTimestamp(packet: Buffer, position: number, momentMs: number): void {
  const wholeSeconds = Math.floor(momentMs / 1000);
  const fractionOfTheSecond = (momentMs - wholeSeconds * 1000) / 1000;
  // Modulo 2^32: after February 2036 NTP's seconds start again from zero (era 1).
  packet.writeUInt32BE((wholeSeconds + secondsFrom1900To1970) % 2 ** 32, position);
  packet.writeUInt32BE(Math.floor(fractionOfTheSecond * 2 ** 32), position + 4);
}

/** Reads an NTP timestamp as ms since 1970. */
function readNtpTimestamp(packet: Buffer, position: number): number {
  let secondsSince1900 = packet.readUInt32BE(position);
  const fraction = packet.readUInt32BE(position + 4);
  // RFC 4330's rule: with the top bit clear the moment is in era 1, after February 2036.
  if (secondsSince1900 < 2 ** 31) {
    secondsSince1900 += 2 ** 32;
  }
  return (secondsSince1900 - secondsFrom1900To1970) * 1000 + (fraction / 2 ** 32) * 1000;
}

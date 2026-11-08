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
import { createSocket } from 'node:dgram';

/** One NTP server: a host name or IPv4 address, and its UDP port (123 unless given). */
export type NtpServerAddress = { host: string; port: number };

/** A usable answer: the offset, the round trip, and when it arrived on the local clock. */
export type NtpAnswer = {
  /** Real time minus local time, in ms; negative when the local clock is ahead. */
  offsetMs: number;
  /** Time spent on the network both ways, in ms. */
  roundTripMs: number;
  /** The local clock when the answer arrived (t4). */
  localTimeAtArrivalMs: number;
};

/** Why a question gave no usable answer. */
export type NtpRefusalReason =
  'timeout' | 'unreachable' | 'malformed' | 'unsynchronized' | 'kissOfDeath';

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
 * Asks one NTP server once. `readLocalTimeMs` is the clock being measured (the server
 * passes its monotonic time); it is read right before the question leaves and as soon as
 * the answer arrives. Never rejects: every failure is an outcome with its reason.
 */
export function queryNtpServerOnce(options: {
  server: NtpServerAddress;
  readLocalTimeMs: () => number;
  timeoutMs: number;
}): Promise<NtpQueryOutcome> {
  const { server, readLocalTimeMs, timeoutMs } = options;
  return new Promise((resolve) => {
    const socket = createSocket('udp4');
    let isFinished = false;
    function finish(outcome: NtpQueryOutcome): void {
      if (isFinished) {
        return;
      }
      isFinished = true;
      clearTimeout(timeoutHandle);
      socket.close();
      resolve(outcome);
    }

    const timeoutHandle = setTimeout(
      () => finish({ isAnswered: false, reason: 'timeout' }),
      timeoutMs,
    );
    socket.on('error', (socketError) =>
      finish({ isAnswered: false, reason: 'unreachable', detail: socketError.message }),
    );
    const sentAtLocalMs = readLocalTimeMs();
    const question = buildNtpQuestion(sentAtLocalMs);
    socket.on('message', (answerPacket) => {
      const arrivedAtLocalMs = readLocalTimeMs();
      finish(readNtpAnswer(answerPacket, question, sentAtLocalMs, arrivedAtLocalMs));
    });
    // A host name is looked up here; a lookup that fails comes back as an error.
    socket.send(question, server.port, server.host, (sendError) => {
      if (sendError !== null) {
        finish({ isAnswered: false, reason: 'unreachable', detail: sendError.message });
      }
    });
  });
}

/** A client question: version 4, mode 3, the send time as its transmit timestamp. */
function buildNtpQuestion(sentAtLocalMs: number): Buffer {
  const question = Buffer.alloc(ntpPacketLength);
  // Leap indicator 0, version 4, mode 3 (client): 00 100 011.
  question[0] = 0x23;
  writeNtpTimestamp(question, transmitTimestampPosition, sentAtLocalMs);
  return question;
}

/** Checks an answer against the question it should answer, then applies the formula. */
function readNtpAnswer(
  answerPacket: Buffer,
  question: Buffer,
  sentAtLocalMs: number,
  arrivedAtLocalMs: number,
): NtpQueryOutcome {
  if (answerPacket.length < ntpPacketLength) {
    return { isAnswered: false, reason: 'malformed', detail: `${answerPacket.length} bytes` };
  }
  const firstByte = answerPacket[0] ?? 0;
  const leapIndicator = firstByte >> 6;
  const mode = firstByte & 0b111;
  const stratum = answerPacket[1] ?? 0;
  if (mode !== 4) {
    return { isAnswered: false, reason: 'malformed', detail: `mode ${mode}` };
  }
  // The server echoes our transmit timestamp; anything else answers another question.
  const echoedTimestamp = answerPacket.subarray(
    originateTimestampPosition,
    originateTimestampPosition + 8,
  );
  const ourTimestamp = question.subarray(transmitTimestampPosition, transmitTimestampPosition + 8);
  if (!echoedTimestamp.equals(ourTimestamp)) {
    return { isAnswered: false, reason: 'malformed', detail: 'not an answer to this question' };
  }
  if (stratum === 0) {
    // A kiss of death: the four letters say why (RATE, DENY, RSTR...).
    const code = answerPacket.toString('ascii', 12, 16).replace(/\0/g, '');
    return { isAnswered: false, reason: 'kissOfDeath', detail: code };
  }
  if (leapIndicator === 3 || stratum >= 16) {
    return { isAnswered: false, reason: 'unsynchronized', detail: `stratum ${stratum}` };
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

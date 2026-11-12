/**
 * Real time from the Date headers of web servers, the way htpdate does (BAJAOVRLAY-76),
 * for networks that block NTP (UDP 123) but let HTTPS through. No dependency: one HEAD
 * request at a time through Node's fetch (httpHeadRequest.ts).
 *
 * The method. A Date header says the server's time to the whole second, read at some
 * moment while it handled the request; the client takes the request's midpoint (halfway
 * between sending and the answer) as that moment. One answer D at local midpoint m says
 * the offset (the server's time minus local time) lies in [D − m, D − m + 1 s). Each next
 * request is timed so its midpoint lands where the server's second would tick over if the
 * offset were the middle of that range; whether the answer's second is the new one or the
 * old one halves the range. Eight requests take a second down to under 10 ms.
 * What could go wrong: a one-sided delay moves the midpoint off the moment the server
 * read its clock by half the difference, so the result is as good as the network is even
 * (tens of ms on the internet, against NTP's few ms); and one server's clock may simply be
 * wrong, which is why a result is kept only when two servers agree within 100 ms.
 */
import { waitFor } from './ntpPolls.js';

/** What one HEAD request brought: the Date header (or none), or why there is no answer. */
export type HeadRequestOutcome =
  | { isAnswered: true; dateHeader: string | undefined }
  | { isAnswered: false; reason: 'timeout' | 'unreachable' | 'aborted'; detail?: string };

/** Sends one HEAD request; never rejects. The default is httpHeadRequest.ts's. */
export type SendHeadRequest = (
  address: string,
  options: { timeoutMs: number; abortSignal: AbortSignal },
) => Promise<HeadRequestOutcome>;

/** A usable answer, as NTP's: the offset, the last round trip, when it arrived locally. */
export type HttpDateAnswer = {
  /** Real time minus local time, in ms. */
  offsetMs: number;
  /** The round trip of the last request, in ms. */
  roundTripMs: number;
  /** The local clock when the last request's answer arrived. */
  localTimeAtArrivalMs: number;
};

/** A poll's outcome: an answer two servers agree on (the first one named), or the problems. */
export type HttpDatePollOutcome =
  | { isAnswered: true; answer: HttpDateAnswer; serverName: string }
  | { isAnswered: false; problems: string[] };

/** The most requests one server is asked per poll: a second halved down to about 8 ms. */
export const maximumRequestsPerServer = 8;

/** Once the range left is this narrow, the server is asked no more. */
const narrowEnoughMs = 10;

/** How long one request waits for its answer; the first also opens the TLS connection. */
export const defaultTimeoutPerRequestMs = 2_000;

/** Two servers further apart than this are not believed: one of them is wrong. */
export const largestDisagreementMs = 100;

/** Time to spare between working out a wait and the request leaving after it. */
const leewayBeforeSendingMs = 5;

const oneSecondMs = 1_000;

/** Where the offset (the server's time minus local time) can still be, in ms. */
type RangeOfTheOffset = { lowestMs: number; highestMs: number };

/** A server that gave an answer, by the name the operator reads. */
type MeasuredServer = { serverName: string; answer: HttpDateAnswer };

/** One server's part of a poll: its answer, its problem, or stopped. */
type MeasurementOfOneServer =
  | ({ kind: 'measured' } & MeasuredServer)
  | { kind: 'problem'; problem: string }
  | { kind: 'stopped' };

/** What measuring one server needs, the same for every server of a poll. */
type MeasurementTools = {
  readLocalTimeMs: () => number;
  sendHeadRequest: SendHeadRequest;
  timeoutPerRequestMs: number;
  abortSignal: AbortSignal;
};

/**
 * Asks every server at once (so their answers are measured over the same seconds, and a
 * machine whose clock runs fast cannot make them look apart), then keeps the answer of the
 * first server that another one agrees with within 100 ms. `abortSignal` (the discipline's
 * stop) ends every request and wait at once, with no answer.
 */
export async function pollHttpDateServers(options: {
  serverAddresses: readonly string[];
  readLocalTimeMs: () => number;
  sendHeadRequest: SendHeadRequest;
  timeoutPerRequestMs?: number | undefined;
  abortSignal: AbortSignal;
}): Promise<HttpDatePollOutcome> {
  const tools: MeasurementTools = {
    readLocalTimeMs: options.readLocalTimeMs,
    sendHeadRequest: options.sendHeadRequest,
    timeoutPerRequestMs: options.timeoutPerRequestMs ?? defaultTimeoutPerRequestMs,
    abortSignal: options.abortSignal,
  };
  const measurements = await Promise.all(
    options.serverAddresses.map((address) => measureTheOffsetOfOneServer(address, tools)),
  );
  if (options.abortSignal.aborted) {
    return { isAnswered: false, problems: ['stopped'] };
  }
  const problems: string[] = [];
  const measuredServers: MeasuredServer[] = [];
  for (const measurement of measurements) {
    if (measurement.kind === 'measured') {
      measuredServers.push({ serverName: measurement.serverName, answer: measurement.answer });
    }
    if (measurement.kind === 'problem') {
      problems.push(measurement.problem);
    }
  }
  const agreedServer = findTheFirstServerAnotherAgreesWith(measuredServers);
  if (agreedServer !== undefined) {
    return { isAnswered: true, answer: agreedServer.answer, serverName: agreedServer.serverName };
  }
  problems.push(describeWhyNoTwoServersAgree(measuredServers));
  return { isAnswered: false, problems };
}

/**
 * Asks one server up to eight times, narrowing the range of its offset each time, and
 * gives the middle of what is left. A failed request ends this server's part of the poll.
 */
async function measureTheOffsetOfOneServer(
  address: string,
  tools: MeasurementTools,
): Promise<MeasurementOfOneServer> {
  const serverName = new URL(address).hostname;
  // A function, not a property read: TypeScript would narrow `aborted` to false after the
  // first check, but an abort can come during any await.
  const hasThePollBeenStopped = (): boolean => tools.abortSignal.aborted;
  let range: RangeOfTheOffset | undefined;
  let lastRoundTripMs = 0;
  let lastArrivalMs = 0;
  for (let requestNumber = 1; requestNumber <= maximumRequestsPerServer; requestNumber += 1) {
    if (range !== undefined) {
      if (range.highestMs - range.lowestMs <= narrowEnoughMs) {
        break;
      }
      const waitMs = findTheWaitBeforeTheNextRequestMs(
        range,
        lastRoundTripMs,
        tools.readLocalTimeMs(),
      );
      await waitFor(waitMs, tools.abortSignal);
    }
    if (hasThePollBeenStopped()) {
      return { kind: 'stopped' };
    }
    const sentAtMs = tools.readLocalTimeMs();
    const outcome = await tools.sendHeadRequest(address, {
      timeoutMs: tools.timeoutPerRequestMs,
      abortSignal: tools.abortSignal,
    });
    const arrivedAtMs = tools.readLocalTimeMs();
    if (!outcome.isAnswered && outcome.reason === 'aborted') {
      return { kind: 'stopped' };
    }
    if (!outcome.isAnswered) {
      const detail = outcome.detail === undefined ? '' : ` (${outcome.detail})`;
      return { kind: 'problem', problem: `${serverName}: ${outcome.reason}${detail}` };
    }
    if (outcome.dateHeader === undefined) {
      return { kind: 'problem', problem: `${serverName}: no Date header` };
    }
    const serverSecondMs = readHttpDateMs(outcome.dateHeader);
    if (serverSecondMs === undefined) {
      return {
        kind: 'problem',
        problem: `${serverName}: unreadable Date header ("${outcome.dateHeader}")`,
      };
    }
    const midpointMs = (sentAtMs + arrivedAtMs) / 2;
    const rangeOfThisAnswer: RangeOfTheOffset = {
      lowestMs: serverSecondMs - midpointMs,
      highestMs: serverSecondMs - midpointMs + oneSecondMs,
    };
    range = range === undefined ? rangeOfThisAnswer : narrowTheRange(range, rangeOfThisAnswer);
    lastRoundTripMs = arrivedAtMs - sentAtMs;
    lastArrivalMs = arrivedAtMs;
  }
  if (range === undefined) {
    return { kind: 'stopped' };
  }
  return {
    kind: 'measured',
    serverName,
    answer: {
      offsetMs: (range.lowestMs + range.highestMs) / 2,
      roundTripMs: lastRoundTripMs,
      localTimeAtArrivalMs: lastArrivalMs,
    },
  };
}

/**
 * How long to wait before the next request, so that its midpoint lands where the server's
 * second ticks over if the offset is the middle of the range: the first such tick far
 * enough ahead for the request to get there (half the last round trip, and a little).
 */
function findTheWaitBeforeTheNextRequestMs(
  range: RangeOfTheOffset,
  lastRoundTripMs: number,
  nowMs: number,
): number {
  const likeliestOffsetMs = (range.lowestMs + range.highestMs) / 2;
  const earliestMidpointMs = nowMs + lastRoundTripMs / 2 + leewayBeforeSendingMs;
  const serverTimeAtTheEarliestMidpointMs = earliestMidpointMs + likeliestOffsetMs;
  const nextTickOfTheServerMs =
    Math.ceil(serverTimeAtTheEarliestMidpointMs / oneSecondMs) * oneSecondMs;
  const aimedMidpointMs = nextTickOfTheServerMs - likeliestOffsetMs;
  const aimedSendingMs = aimedMidpointMs - lastRoundTripMs / 2;
  return aimedSendingMs - nowMs;
}

/**
 * The part of the range a new answer leaves. When the two do not overlap at all, a
 * one-sided delay moved a midpoint: the truth is where they meet, within that delay, so
 * the range closes there rather than keeping either whole.
 */
function narrowTheRange(range: RangeOfTheOffset, rangeOfAnAnswer: RangeOfTheOffset): RangeOfTheOffset {
  const lowestMs = Math.max(range.lowestMs, rangeOfAnAnswer.lowestMs);
  const highestMs = Math.min(range.highestMs, rangeOfAnAnswer.highestMs);
  if (lowestMs <= highestMs) {
    return { lowestMs, highestMs };
  }
  const whereTheyMeetMs = (lowestMs + highestMs) / 2;
  return { lowestMs: whereTheyMeetMs, highestMs: whereTheyMeetMs };
}

/** The first server (in the list's order) whose offset another's is within 100 ms of. */
function findTheFirstServerAnotherAgreesWith(
  measuredServers: readonly MeasuredServer[],
): MeasuredServer | undefined {
  for (const [position, server] of measuredServers.entries()) {
    const laterServers = measuredServers.slice(position + 1);
    const isAnotherInAgreement = laterServers.some(
      (laterServer) =>
        Math.abs(laterServer.answer.offsetMs - server.answer.offsetMs) <= largestDisagreementMs,
    );
    if (isAnotherInAgreement) {
      return server;
    }
  }
  return undefined;
}

/** The problem line when no two servers agree: too few answered, or the first two apart. */
function describeWhyNoTwoServersAgree(measuredServers: readonly MeasuredServer[]): string {
  const [firstServer, secondServer] = measuredServers;
  if (firstServer === undefined) {
    return 'no server answered';
  }
  if (secondServer === undefined) {
    return `only one server answered (${firstServer.serverName})`;
  }
  const apartMs = Math.round(
    Math.abs(firstServer.answer.offsetMs - secondServer.answer.offsetMs),
  );
  return `no two servers agree within ${largestDisagreementMs} ms: ${firstServer.serverName} and ${secondServer.serverName} disagree by ${apartMs} ms`;
}

const monthNumbers: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

// RFC 9110's date, which every current web server sends: "Sat, 10 Oct 2026 13:00:04 GMT".
const httpDatePattern =
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/;

/**
 * Reads a Date header as ms since 1970, or undefined when it is not RFC 9110's date. Not
 * Date.parse: it takes almost any text, and would read a proxy's local-time header in this
 * machine's zone, hours off.
 */
export function readHttpDateMs(dateHeader: string): number | undefined {
  const dateMatch = httpDatePattern.exec(dateHeader.trim());
  if (dateMatch === null) {
    return undefined;
  }
  const [, dayText, monthName, yearText, hoursText, minutesText, secondsText] = dateMatch;
  const monthNumber = monthNumbers[monthName ?? ''];
  if (monthNumber === undefined) {
    return undefined;
  }
  return Date.UTC(
    Number(yearText),
    monthNumber,
    Number(dayText),
    Number(hoursText),
    Number(minutesText),
    Number(secondsText),
  );
}

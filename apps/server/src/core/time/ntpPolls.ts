import { isIPv4 } from 'node:net';

import {
  type LookUpIpv4Addresses,
  lookUpIpv4AddressesThroughDns,
} from './ipv4LookUpThroughCAres.js';
import {
  type NtpAnswer,
  type NtpQueryOutcome,
  type NtpServerAddress,
  queryNtpServerOnce,
} from './ntpClient.js';

/** How many questions a regular poll asks a server that answers. */
export const questionsPerPoll = 4;

/** How long one question waits for its answer before it counts as lost. */
export const defaultTimeoutPerQuestionMs = 1_000;

/**
 * The pause between two questions to the same server. NTP.br's and the pool's servers
 * drop questions that come faster, or answer them with a RATE kiss of death.
 */
export const pauseBetweenQuestionsMs = 2_000;

/** A poll's outcome: the best answer and the server it came from, or each server's problem. */
export type NtpPollOutcome = (
  | { isAnswered: true; answer: NtpAnswer; serverName: string }
  | { isAnswered: false; problems: string[] }
) & {
  /** Whether a server sent a RATE kiss of death: the polls must come less often. */
  wasAskedToSlowDown: boolean;
};

/** What a poll may be told: how many questions per server, and which server to ask last. */
export type NtpPollRequest = {
  questionsPerServer: number;
  /** A server name (`host:port`) to ask after the others: a confirmation's second opinion. */
  serverToAskLast: string | undefined;
};

/** A wait between two questions, which an abort ends early. */
export type WaitBetweenQuestions = (waitMs: number, abortSignal?: AbortSignal) => Promise<void>;

/** The default wait between two questions: a timer, cleared and ended early by an abort. */
export function waitFor(waitMs: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (abortSignal?.aborted === true) {
      resolve();
      return;
    }
    function endTheWait(): void {
      clearTimeout(timer);
      abortSignal?.removeEventListener('abort', endTheWait);
      resolve();
    }
    const timer = setTimeout(endTheWait, waitMs);
    abortSignal?.addEventListener('abort', endTheWait, { once: true });
  });
}

/**
 * Polls the NTP servers in their order (the one named to be asked last moved to the end):
 * looks up the server's name once, then asks it up to `questionsPerServer` times, 2 s
 * apart, and keeps the answer with the shortest round trip, since a short round trip
 * leaves the least room for a one-sided delay. A server that fails a question (no answer,
 * a malformed one, a kiss of death) is not asked again in this poll; the next server is
 * asked only when the one before gave no answer at all.
 * `abortSignal` (the discipline's stop) ends the poll at once, with no answer: the pause
 * and the question in flight end, and nothing more is sent.
 * What could go wrong: one lost UDP packet hands the poll to the next server, which is a
 * little farther away (NTP.br after the track's own); the next poll starts at the first.
 * A DNS look-up in flight is not aborted (c-ares cancels a whole resolver, not one query);
 * it ends within 2 s, holds no socket of the poll's, and the poll stops right after it.
 */
export async function pollNtpServers(options: {
  servers: readonly NtpServerAddress[];
  readLocalTimeMs: () => number;
  questionsPerServer?: number | undefined;
  serverToAskLast?: string | undefined;
  timeoutPerQuestionMs?: number | undefined;
  waitBetweenQuestions?: WaitBetweenQuestions | undefined;
  lookUpIpv4Addresses?: LookUpIpv4Addresses | undefined;
  abortSignal?: AbortSignal | undefined;
}): Promise<NtpPollOutcome> {
  const { abortSignal } = options;
  const timeoutMs = options.timeoutPerQuestionMs ?? defaultTimeoutPerQuestionMs;
  const questionsPerServer = options.questionsPerServer ?? questionsPerPoll;
  const waitBetweenQuestions = options.waitBetweenQuestions ?? waitFor;
  const lookUpIpv4Addresses = options.lookUpIpv4Addresses ?? lookUpIpv4AddressesThroughDns;
  const problems: string[] = [];
  let wasAskedToSlowDown = false;
  // A function, not a property read: TypeScript would narrow `aborted` to false after the
  // first check, but an abort can come during any await.
  const hasThePollBeenStopped = (): boolean => abortSignal?.aborted === true;
  const buildTheOutcomeOfAStoppedPoll = (): NtpPollOutcome => ({
    isAnswered: false,
    problems: [...problems, 'stopped'],
    wasAskedToSlowDown,
  });
  for (const server of putTheServerToAskLastAtTheEnd(options.servers, options.serverToAskLast)) {
    const serverName = nameTheServer(server);
    if (hasThePollBeenStopped()) {
      return buildTheOutcomeOfAStoppedPoll();
    }
    const lookUp = await lookUpTheIpv4AddressOf(server.host, lookUpIpv4Addresses);
    if (hasThePollBeenStopped()) {
      return buildTheOutcomeOfAStoppedPoll();
    }
    if (!lookUp.isFound) {
      problems.push(`${serverName}: dns (${lookUp.code})`);
      continue;
    }
    const answers: NtpAnswer[] = [];
    for (let questionNumber = 1; questionNumber <= questionsPerServer; questionNumber += 1) {
      if (questionNumber > 1) {
        await waitBetweenQuestions(pauseBetweenQuestionsMs, abortSignal);
      }
      if (hasThePollBeenStopped()) {
        return buildTheOutcomeOfAStoppedPoll();
      }
      const outcome: NtpQueryOutcome = await queryNtpServerOnce({
        server: { ipv4Address: lookUp.ipv4Address, port: server.port },
        readLocalTimeMs: options.readLocalTimeMs,
        timeoutMs,
        abortSignal,
      });
      if (!outcome.isAnswered && outcome.reason === 'aborted') {
        return buildTheOutcomeOfAStoppedPoll();
      }
      if (!outcome.isAnswered) {
        const detail = outcome.detail === undefined ? '' : ` (${outcome.detail})`;
        problems.push(`${serverName}: ${outcome.reason}${detail}`);
        if (outcome.reason === 'kissOfDeath' && outcome.detail === 'RATE') {
          wasAskedToSlowDown = true;
        }
        break;
      }
      answers.push(outcome.answer);
    }
    const bestAnswer = findTheAnswerWithTheShortestRoundTrip(answers);
    if (bestAnswer !== undefined) {
      return { isAnswered: true, answer: bestAnswer, serverName, wasAskedToSlowDown };
    }
  }
  return { isAnswered: false, problems, wasAskedToSlowDown };
}

/** How a server is named in the log and in "Verificar servidor": `host:port`. */
export function nameTheServer(server: NtpServerAddress): string {
  return `${server.host}:${server.port}`;
}

/** The servers in their order, the one named (if any) moved to the end. */
function putTheServerToAskLastAtTheEnd(
  servers: readonly NtpServerAddress[],
  serverToAskLast: string | undefined,
): NtpServerAddress[] {
  const serversFirst = servers.filter((server) => nameTheServer(server) !== serverToAskLast);
  const serversLast = servers.filter((server) => nameTheServer(server) === serverToAskLast);
  return [...serversFirst, ...serversLast];
}

/** A host's first IPv4 address (an address is its own), or the look-up's error code. */
async function lookUpTheIpv4AddressOf(
  host: string,
  lookUpIpv4Addresses: LookUpIpv4Addresses,
): Promise<{ isFound: true; ipv4Address: string } | { isFound: false; code: string }> {
  if (isIPv4(host)) {
    return { isFound: true, ipv4Address: host };
  }
  try {
    const addresses = await lookUpIpv4Addresses(host);
    const firstAddress = addresses[0];
    if (firstAddress === undefined) {
      return { isFound: false, code: 'ENODATA' };
    }
    return { isFound: true, ipv4Address: firstAddress };
  } catch (lookUpError) {
    const code = (lookUpError as { code?: unknown }).code;
    return { isFound: false, code: typeof code === 'string' ? code : 'unknown' };
  }
}

/** The answer whose round trip was shortest, or undefined when there is none. */
function findTheAnswerWithTheShortestRoundTrip(
  answers: readonly NtpAnswer[],
): NtpAnswer | undefined {
  let bestAnswer: NtpAnswer | undefined;
  for (const answer of answers) {
    if (bestAnswer === undefined || answer.roundTripMs < bestAnswer.roundTripMs) {
      bestAnswer = answer;
    }
  }
  return bestAnswer;
}

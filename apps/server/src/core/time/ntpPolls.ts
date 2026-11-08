import {
  type NtpAnswer,
  type NtpQueryOutcome,
  type NtpServerAddress,
  queryNtpServerOnce,
} from './ntpClient.js';

/** How many questions one poll asks a server that answers. */
export const questionsPerPoll = 4;

/** How long one question waits for its answer before it counts as lost. */
export const defaultTimeoutPerQuestionMs = 1_000;

/** A poll's outcome: the best answer and the server it came from, or each server's problem. */
export type NtpPollOutcome =
  | { isAnswered: true; answer: NtpAnswer; serverName: string }
  | { isAnswered: false; problems: string[] };

/**
 * Polls the NTP servers in their order: asks the first one up to four times, one question
 * after another, and keeps the answer with the shortest round trip, since a short round
 * trip leaves the least room for a one-sided delay. A server that fails a question (no
 * answer, a malformed one, a kiss of death) is not asked again in this poll; the next
 * server is asked only when the one before gave no answer at all.
 * What could go wrong: one lost UDP packet hands the poll to the next server, which is a
 * little farther away (NTP.br after the track's own); the next poll starts at the first.
 */
export async function pollNtpServers(options: {
  servers: readonly NtpServerAddress[];
  readLocalTimeMs: () => number;
  timeoutPerQuestionMs?: number | undefined;
}): Promise<NtpPollOutcome> {
  const timeoutMs = options.timeoutPerQuestionMs ?? defaultTimeoutPerQuestionMs;
  const problems: string[] = [];
  for (const server of options.servers) {
    const serverName = `${server.host}:${server.port}`;
    const answers: NtpAnswer[] = [];
    for (let questionNumber = 1; questionNumber <= questionsPerPoll; questionNumber += 1) {
      const outcome: NtpQueryOutcome = await queryNtpServerOnce({
        server,
        readLocalTimeMs: options.readLocalTimeMs,
        timeoutMs,
      });
      if (!outcome.isAnswered) {
        const detail = outcome.detail === undefined ? '' : ` (${outcome.detail})`;
        problems.push(`${serverName}: ${outcome.reason}${detail}`);
        break;
      }
      answers.push(outcome.answer);
    }
    const bestAnswer = findTheAnswerWithTheShortestRoundTrip(answers);
    if (bestAnswer !== undefined) {
      return { isAnswered: true, answer: bestAnswer, serverName };
    }
  }
  return { isAnswered: false, problems };
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

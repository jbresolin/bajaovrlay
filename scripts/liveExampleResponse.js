// The answer `pnpm serve:flex-example` gives at each request: the example response of the
// fictional timing system, made to read like a live one. The file is a fixed snapshot of
// one instant of March 2027, with the session clock running ("estado": "RUN"). The flex
// mapping reads the session's moment from "gerado_em" and the clock from "restante_s", so
// served unchanged the session card would count down from a moment months away (or sit at
// 0:00 once that moment has passed). Stamping each answer with its own moment, and the
// time left run down since the script started, keeps the demo's race clock believable.

/**
 * The parts of the example response this file changes; the rest is served as it is.
 * @typedef {{
 *   gerado_em: string,
 *   prova: { relogio: { restante_s: number } } & Record<string, unknown>,
 *   classificacao: unknown[],
 * } & Record<string, unknown>} ExampleTimingSystemResponse
 */

// Brasília is three hours behind UTC, with no summer time since 2019. The example writes
// its moment with that zone, as a Brazilian timing system would.
const brasiliaOffsetMs = -3 * 60 * 60 * 1_000;
const brasiliaZoneText = '-03:00';

/**
 * Builds the answer to a request made at `answeredAtMs`: a copy of the example with
 * "gerado_em" set to that moment and "restante_s" lowered by the time since the script
 * started (never below zero). The example itself is not changed.
 * @param {ExampleTimingSystemResponse} exampleResponse the example as read at start
 * @param {number} scriptStartedAtMs when the script started, in ms since 1970
 * @param {number} answeredAtMs when this answer is made, in ms since 1970
 * @returns {ExampleTimingSystemResponse}
 */
export function stampExampleResponseWithTheMomentOfAnswer(
  exampleResponse,
  scriptStartedAtMs,
  answeredAtMs,
) {
  const answer = structuredClone(exampleResponse);

  answer.gerado_em = writeMomentInBrasiliaTime(answeredAtMs);

  const secondsSinceStart = (answeredAtMs - scriptStartedAtMs) / 1_000;
  const secondsLeftNow = exampleResponse.prova.relogio.restante_s - secondsSinceStart;
  // Rounded to the ms, as the file writes it, so 4559.052 - 90.5 does not read 4468.551999….
  const secondsLeftRoundedToTheMs = Math.round(secondsLeftNow * 1_000) / 1_000;
  answer.prova.relogio.restante_s = Math.max(0, secondsLeftRoundedToTheMs);

  return answer;
}

/**
 * Writes a moment as ISO 8601 text in Brasília time with its zone:
 * "2026-10-18T14:01:30.000-03:00".
 * @param {number} momentMs ms since 1970
 * @returns {string}
 */
function writeMomentInBrasiliaTime(momentMs) {
  // toISOString always writes UTC with a "Z"; shifting the moment by the offset first
  // makes its digits Brasília's, and the "Z" is then replaced by Brasília's zone.
  const shiftedMomentText = new Date(momentMs + brasiliaOffsetMs).toISOString();
  return shiftedMomentText.replace('Z', brasiliaZoneText);
}

// The text of build-id.json, the one id per `pnpm build` that both Vite builds embed and
// the server sends in its hello (packages/shared/src/build). The id is the moment the
// build started, in UTC: unique enough for one machine building one checkout, readable
// in a log line ("built 19 October at 07:40"), and it needs neither git nor randomness.

/**
 * The text of build-id.json for a build started at `buildMoment`, as the server's
 * readBuildId.ts and the Vite configs read it: `{ "buildId": "<ISO moment>" }`.
 * @param {Date} buildMoment when `pnpm build` started
 * @returns {string}
 */
export function writeBuildIdFileText(buildMoment) {
  const buildIdFile = { buildId: buildMoment.toISOString() };
  return `${JSON.stringify(buildIdFile, null, 2)}\n`;
}

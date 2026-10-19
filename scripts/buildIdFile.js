// The two build-id files of `pnpm build` (packages/shared/src/build). The id is the moment
// the build started, in UTC: unique enough for one machine building one checkout,
// readable in a log line ("built 19 October at 07:40"), and it needs neither git nor
// randomness. build-id.building.json holds the id of the build under way, which both Vite
// builds embed; build-id.json holds the id of the last build that finished, which the
// server reads at boot. Two files, so a failed or unfinished build never changes the id
// a server announces.
import { copyFileSync } from 'node:fs';

/** Where writeBuildId.js leaves the id of the build under way; the Vite configs read it. */
export const buildingBuildIdFileUrl = new URL('../build-id.building.json', import.meta.url);

/** Where publishBuildId.js leaves the id of the last finished build; the server reads it. */
export const publishedBuildIdFileUrl = new URL('../build-id.json', import.meta.url);

/**
 * The text of a build-id file for a build started at `buildMoment`, as the server's
 * readBuildId.ts and the Vite configs read it: `{ "buildId": "<ISO moment>" }`.
 * @param {Date} buildMoment when `pnpm build` started
 * @returns {string}
 */
export function writeBuildIdFileText(buildMoment) {
  const buildIdFile = { buildId: buildMoment.toISOString() };
  return `${JSON.stringify(buildIdFile, null, 2)}\n`;
}

/**
 * Copies the id of the build that just finished to the file the server reads. Throws
 * when there is no id of a build under way (writeBuildId.js did not run), which fails
 * `pnpm build` rather than leaving the server an id no page embeds.
 * @param {URL | string} buildingFile build-id.building.json
 * @param {URL | string} publishedFile build-id.json
 * @returns {void}
 */
export function publishBuildIdOfTheFinishedBuild(buildingFile, publishedFile) {
  copyFileSync(buildingFile, publishedFile);
}

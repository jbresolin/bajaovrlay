// The last step of `pnpm build`, reached only when every package built (the root script
// chains the steps with &&): copies build-id.building.json to build-id.json, the file the
// server reads once at boot and names in every hello. A running server keeps the id it
// booted with, so the new build, pages and server code alike, takes effect at the restart.
import {
  buildingBuildIdFileUrl,
  publishBuildIdOfTheFinishedBuild,
  publishedBuildIdFileUrl,
} from './buildIdFile.js';

publishBuildIdOfTheFinishedBuild(buildingBuildIdFileUrl, publishedBuildIdFileUrl);

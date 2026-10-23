// Public surface of the media module. Core and other modules import from here, never from
// the files inside.

// Sends each media command (recordUploadedMedia, deleteMedia) to its reducer; core's
// reduceCommand calls it.
export { type MediaCommand, reduceMediaCommand } from './reducers/reduceMediaCommand.js';
// The check upsertEntity and importEntities run: every image a record names is stored.
export { findRefusalOfImagesNotInTheStore } from './mediaOfRecords.js';
// Loads the media slice from its row at boot.
export { loadMediaSlice } from './loadMediaSlice.js';
// Where the images live in DATA_DIR, and the service that removes a deleted image's file.
export {
  buildMediaFolderPath,
  type MediaService,
  type MediaServiceOptions,
  startMediaService,
} from './service.js';
// The REST route POST /api/v1/media, its body limit, how it reads the file, its answers.
export {
  buildFileMissingAnswer,
  buildFileTooLargeAnswer,
  largestMediaUploadBodyInBytes,
  postMediaRoute,
  readUploadedFile,
} from './api.js';
// Storing one upload: checked by its bytes, named by its SHA-256, written, recorded.
export { storeUploadedImage } from './mediaUpload.js';
// GET /media/<mediaId>, with a year of cache, nosniff and the policy that runs nothing.
export { contentSecurityPolicyOfImages, serveMediaFiles } from './api.js';

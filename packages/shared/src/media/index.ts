// Everything about the media store (uploaded logos and photos) that @bajaovrlay/shared
// exports. The package's own index.ts re-exports this file with one line; other packages
// import from '@bajaovrlay/shared', never from here.

// A media id (the SHA-256 of the file), its pattern, the URL an image is served at, and
// the id read back from such a URL.
export { buildMediaUrl, mediaIdPattern, MediaIdSchema, readMediaIdOfMediaUrl } from './mediaId.js';
// One image of the store, the media slice, the four accepted types and the 5 MB limit.
export {
  type AcceptedImageContentType,
  AcceptedImageContentTypeSchema,
  largestMediaSizeInBytes,
  type Media,
  type MediaRecord,
  MediaRecordSchema,
  MediaSchema,
} from './mediaRecord.js';
// The two commands (record an upload, server only; delete an image) and the upload's answer.
export {
  type DeleteMediaCommand,
  DeleteMediaCommandSchema,
  type MediaUploadAnswer,
  MediaUploadAnswerSchema,
  type RecordUploadedMediaCommand,
  RecordUploadedMediaCommandSchema,
} from './mediaCommands.js';
// The images a record names, and every use of one image in the library.
export {
  type EntityRecordOfType,
  findUsesOfMedia,
  listMediaFieldsOfRecord,
  type MediaFieldOfRecord,
  type MediaUse,
  type PlacesThatUseMedia,
} from './mediaReferences.js';

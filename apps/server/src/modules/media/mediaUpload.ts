// Storing one uploaded image: checked, named by its content, written, then recorded
// through the one command path.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { largestMediaSizeInBytes, type MediaUploadAnswer } from '@bajaovrlay/shared';

import type { ErrorAnswerBody } from '../../core/http/errorAnswers.js';
import { ptBR } from '../../core/messages/ptBR.js';
import { mediaStoreActor } from '../../core/store/commandActors.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { readImageContent } from './imageContent.js';

/** One file as the route received it: its bytes and the name it had on the operator's machine. */
export type UploadedFile = { bytes: Buffer; fileName: string };

/** What storing an upload gives: the answer to send, or the error answer and its status. */
export type MediaUploadOutcome =
  | { isStored: true; answer: MediaUploadAnswer }
  | { isStored: false; httpStatus: 413 | 415 | 422 | 500; body: ErrorAnswerBody };

/**
 * Stores one uploaded image, in this order: refuse a file over 5 MB (413); read what the
 * bytes are, never the name (415 for anything but PNG, JPEG, WebP or SVG, 422 when its
 * size cannot be read); name it by its SHA-256; write it to `<mediaFolder>/<mediaId>`
 * unless that file is already there (the same bytes are the same media); record it with
 * recordUploadedMedia as `sistema:midia`, the one command path. Nothing is written for a
 * refused file, and a file written for a record the store then refused is removed again.
 */
export function storeUploadedImage(
  upload: UploadedFile,
  dependencies: { stateStore: StateStore; mediaFolder: string },
): MediaUploadOutcome {
  if (upload.bytes.length > largestMediaSizeInBytes) {
    return refuseUpload(413, 'MEDIA_TOO_LARGE', ptBR.mediaErrors.fileTooLarge);
  }
  const content = readImageContent(upload.bytes);
  if (!content.isReadable && content.problem === 'notAnAcceptedImage') {
    const message = ptBR.mediaErrors.typeNotAccepted(upload.fileName);
    return refuseUpload(415, 'MEDIA_TYPE_NOT_ACCEPTED', message);
  }
  if (!content.isReadable) {
    const message = ptBR.mediaErrors.sizeUnreadable(upload.fileName);
    return refuseUpload(422, 'MEDIA_SIZE_UNREADABLE', message);
  }

  const mediaId = createHash('sha256').update(upload.bytes).digest('hex');
  mkdirSync(dependencies.mediaFolder, { recursive: true });
  const filePath = join(dependencies.mediaFolder, mediaId);
  const wasAlreadyOnDisk = existsSync(filePath);
  if (!wasAlreadyOnDisk) {
    writeFileSync(filePath, upload.bytes);
  }
  const outcome = dependencies.stateStore.applyCommand(
    {
      type: 'recordUploadedMedia',
      media: {
        mediaId,
        fileName: upload.fileName,
        contentType: content.contentType,
        sizeBytes: upload.bytes.length,
        widthPx: content.widthPx,
        heightPx: content.heightPx,
      },
    },
    mediaStoreActor,
  );
  if (!outcome.ok) {
    // Only a bug gets here (the record is built from what was just checked); the file
    // is not left behind for a record that does not exist.
    if (!wasAlreadyOnDisk) {
      rmSync(filePath, { force: true });
    }
    return refuseUpload(500, outcome.error.code, outcome.error.message);
  }
  return {
    isStored: true,
    answer: {
      mediaId,
      contentType: content.contentType,
      widthPx: content.widthPx,
      heightPx: content.heightPx,
    },
  };
}

/** The error answer of a refused upload. */
function refuseUpload(
  httpStatus: 413 | 415 | 422 | 500,
  code: string,
  message: string,
): MediaUploadOutcome {
  return { isStored: false, httpStatus, body: { error: { code, message } } };
}

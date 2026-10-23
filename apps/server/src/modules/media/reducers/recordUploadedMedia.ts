import type { RecordUploadedMediaCommand } from '@bajaovrlay/shared';

import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';

/**
 * recordUploadedMedia: lists an image the upload route has just written under its media
 * id, stamped with the command's moment. An id already listed changes nothing: the same
 * bytes are the same media, and the first record (its file name, its moment) stays.
 */
export function reduceRecordUploadedMedia(
  slices: SlicesChangedByCommands,
  command: RecordUploadedMediaCommand,
  context: ReducerContext,
): ReducerOutcome {
  const isAlreadyListed = slices.media.some(
    (mediaRecord) => mediaRecord.mediaId === command.media.mediaId,
  );
  if (isAlreadyListed) {
    return { status: 'applied', slices };
  }
  const mediaRecord = { ...command.media, uploadedAt: context.now };
  return { status: 'applied', slices: { ...slices, media: [...slices.media, mediaRecord] } };
}

// The check every write of the entity library runs: a record may only name images the
// media store holds.
import {
  type CommandError,
  type EntityRecordOfType,
  listMediaFieldsOfRecord,
  type Media,
} from '@bajaovrlay/shared';

import { refuseMediaNotInTheStore } from './mediaRefusals.js';

/**
 * The refusal for the first image the records name that the media slice does not list,
 * or undefined when every one is there. upsertEntity and importEntities run it before
 * writing, so the library never points at a file that is not on disk (deleteMedia is
 * refused while an image is used, which keeps it so afterwards).
 */
export function findRefusalOfImagesNotInTheStore(
  media: Media,
  recordsOfType: EntityRecordOfType[],
): CommandError | undefined {
  const mediaIdsInTheStore = new Set(media.map((mediaRecord) => mediaRecord.mediaId));
  for (const recordOfType of recordsOfType) {
    for (const field of listMediaFieldsOfRecord(recordOfType)) {
      if (!mediaIdsInTheStore.has(field.mediaId)) {
        return refuseMediaNotInTheStore(field.fieldLabel);
      }
    }
  }
  return undefined;
}

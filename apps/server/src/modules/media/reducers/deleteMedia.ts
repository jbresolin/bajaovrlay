import { type DeleteMediaCommand, findUsesOfMedia } from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { refuseMediaInUse } from '../mediaRefusals.js';

/**
 * deleteMedia: takes an image out of the media slice; the media service then removes its
 * file. Refused with MEDIA_IN_USE while a team, person or sponsor names it, listing each
 * use, so a logo on air never loses its file. An id not listed changes nothing.
 */
export function reduceDeleteMedia(
  slices: SlicesChangedByCommands,
  command: DeleteMediaCommand,
): ReducerOutcome {
  const mediaRecord = slices.media.find((candidate) => candidate.mediaId === command.mediaId);
  if (mediaRecord === undefined) {
    return { status: 'applied', slices };
  }
  const uses = findUsesOfMedia(slices, command.mediaId);
  if (uses.length > 0) {
    return { status: 'refused', error: refuseMediaInUse(mediaRecord.fileName, uses) };
  }
  const mediaKept = slices.media.filter((candidate) => candidate !== mediaRecord);
  return { status: 'applied', slices: { ...slices, media: mediaKept } };
}

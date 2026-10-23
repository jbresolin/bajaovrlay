// What an upload may add to the disk of the race-day laptop until M4 brings logins: a
// cap on the store, and a margin of free disk no image is written into.
import { statfsSync } from 'node:fs';

import type { Media } from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';

const bytesPerMegabyte = 1024 * 1024;

/** The most images the store keeps (gate 2 of PR #23). */
export const mostImagesInTheStore = 1000;

/** The most bytes the store keeps, 500 MB: a season of logos and photos many times over. */
export const largestStoreSizeInBytes = 500 * bytesPerMegabyte;

/**
 * The free disk an upload must leave, 1 GB: the database, the logs and the USB backup
 * need room too, and a full disk would stop the server writing state at all.
 */
export const freeDiskMarginInBytes = 1024 * bytesPerMegabyte;

/** Why an upload is refused by the limits; nothing when it fits. */
export type StoreLimitRefusal = { code: string; message: string };

/**
 * The refusal of a new image of `sizeBytes`, or undefined when it fits: the store already
 * holds 1000 images or would pass 500 MB, or the disk would keep less than 1 GB free.
 * Only an image the store does not list yet is checked; the same bytes add nothing.
 */
export function findRefusalOfTheStoreLimits(
  media: Media,
  sizeBytes: number,
  freeBytesOfTheDisk: number,
): StoreLimitRefusal | undefined {
  const bytesStored = media.reduce((sum, mediaRecord) => sum + mediaRecord.sizeBytes, 0);
  const isStoreFullOfImages = media.length >= mostImagesInTheStore;
  const wouldPassTheStoreSize = bytesStored + sizeBytes > largestStoreSizeInBytes;
  if (isStoreFullOfImages || wouldPassTheStoreSize) {
    return { code: 'MEDIA_STORE_FULL', message: ptBR.mediaErrors.storeFull };
  }
  const wouldEatIntoTheMargin = freeBytesOfTheDisk - sizeBytes < freeDiskMarginInBytes;
  if (wouldEatIntoTheMargin) {
    return { code: 'MEDIA_DISK_NEARLY_FULL', message: ptBR.mediaErrors.diskNearlyFull };
  }
  return undefined;
}

/**
 * The bytes free to an unprivileged process on the disk holding `folder` (statfs). The
 * folder must exist; the upload creates the media folder before asking.
 */
export function readFreeBytesOfTheDiskOf(folder: string): number {
  const diskStatistics = statfsSync(folder);
  return diskStatistics.bavail * diskStatistics.bsize;
}

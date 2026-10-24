// Keeping DATA_DIR/media in step with the media slice: the file of an image that leaves
// the slice is removed.
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import type { ServerLogger } from '../../core/logger/createLogger.js';
import type { StateStore } from '../../core/store/createStateStore.js';

/** What the service needs: the store, the media folder and the logger. */
export type MediaServiceOptions = {
  stateStore: StateStore;
  mediaFolder: string;
  logger: ServerLogger;
};

/** The running service; stop() stops watching the store. */
export type MediaService = { stop: () => void };

/** DATA_DIR/media: where uploaded images are kept, one file per media id. */
export function buildMediaFolderPath(dataFolder: string): string {
  return join(dataFolder, 'media');
}

/**
 * Creates the media folder when it is missing, then watches the store: when an image
 * leaves the media slice (deleteMedia), its file is removed, synchronously and within the
 * same listener call, so the folder holds exactly the files the slice lists and its size
 * on the Cadastros page is the slice's sum. A file that cannot be removed is logged and
 * left; nothing on air reads it any more.
 */
export function startMediaService(options: MediaServiceOptions): MediaService {
  const { stateStore, mediaFolder, logger } = options;
  mkdirSync(mediaFolder, { recursive: true });
  let mediaIdsListed = new Set(stateStore.readAllSlices().media.map((media) => media.mediaId));

  const stopWatchingTheStore = stateStore.subscribeToSliceChanges((changedSliceNames, slices) => {
    if (!changedSliceNames.includes('media')) {
      return;
    }
    const mediaIdsNow = new Set(slices.media.map((media) => media.mediaId));
    for (const mediaId of mediaIdsListed) {
      if (!mediaIdsNow.has(mediaId)) {
        removeMediaFile(mediaId);
      }
    }
    mediaIdsListed = mediaIdsNow;
  });

  /** Removes one image's file, logging instead of throwing when it cannot. */
  function removeMediaFile(mediaId: string): void {
    try {
      rmSync(join(mediaFolder, mediaId), { force: true });
      logger.info({ media_id: mediaId }, 'media file removed');
    } catch (removalError) {
      logger.error({ err: removalError, media_id: mediaId }, 'media file could not be removed');
    }
  }

  logger.info({ media_folder: mediaFolder }, 'media service started');
  return { stop: stopWatchingTheStore };
}

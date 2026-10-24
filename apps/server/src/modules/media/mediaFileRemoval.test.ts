/**
 * Removing an image's file once it leaves the media slice (apps/server)
 *
 * What this module is for:
 *   Reducers are pure, so deleteMedia only takes the image out of the `media` slice. The
 *   media service watches the slice and removes from DATA_DIR/media the file of every
 *   image that left it, the way the recorder writes what the reducers decided
 *   (BAJAOVRLAY-19). The folder then holds exactly the files the slice lists, so its
 *   size, shown on the Cadastros page, is the sum the slice gives.
 *
 * What these tests prove (with a real store, the app and a temporary media folder):
 *   - After deleteMedia of an unused image its file is gone, and the other image's file
 *     stays.
 *   - A refused deleteMedia (the image is in use) leaves the file where it is.
 *
 * What these tests deliberately do not cover:
 *   - The rules of deleteMedia; reducers/mediaCommands.test.ts.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createLogger } from '../../core/logger/createLogger.js';
import { buildTeam42 } from '../entities/entitySlices.testSupport.js';
import { buildJpegCarPhoto, buildPngLogo } from './imageFiles.testSupport.js';
import { createAppWithAMediaFolder, uploadFile } from './mediaOnTheApp.testSupport.js';
import { startMediaService } from './service.js';

/** The media id of some bytes: their SHA-256 in hexadecimal. */
function computeMediaId(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('the media service', () => {
  it('removes the file of a deleted image and keeps the others', async () => {
    // Arrange: two images uploaded, the service watching the store.
    const { app, stateStore, mediaFolder } = createAppWithAMediaFolder();
    const mediaService = startMediaService({
      stateStore,
      mediaFolder,
      logger: createLogger({ level: 'silent' }),
    });
    const logo = buildPngLogo(16, 16);
    const oldPhoto = buildJpegCarPhoto(1920, 1280);
    await uploadFile(app, logo, 'logo-ufpr.png', 'image/png');
    await uploadFile(app, oldPhoto, 'carro-42-antigo.jpg', 'image/jpeg');

    // Act: delete the old photo, as "Limpar imagens sem uso" does.
    stateStore.applyCommand(
      { type: 'deleteMedia', mediaId: computeMediaId(oldPhoto) },
      'operador:tablet',
    );
    mediaService.stop();

    // Assert: the photo's file is gone, the logo's stays.
    expect(existsSync(join(mediaFolder, computeMediaId(oldPhoto))), 'the photo is removed').toBe(
      false,
    );
    expect(existsSync(join(mediaFolder, computeMediaId(logo))), 'the logo stays').toBe(true);
  });

  it('leaves the file of an image in use where it is', async () => {
    // Arrange: the logo uploaded and used by team 42, the service watching.
    const { app, stateStore, mediaFolder } = createAppWithAMediaFolder();
    const mediaService = startMediaService({
      stateStore,
      mediaFolder,
      logger: createLogger({ level: 'silent' }),
    });
    const logo = buildPngLogo(16, 16);
    await uploadFile(app, logo, 'logo-ufpr.png', 'image/png');
    stateStore.applyCommand(
      {
        type: 'upsertEntity',
        entityType: 'team',
        record: { ...buildTeam42(), logoMediaId: computeMediaId(logo) },
      },
      'operador:tablet',
    );

    // Act: try to delete it.
    const outcome = stateStore.applyCommand(
      { type: 'deleteMedia', mediaId: computeMediaId(logo) },
      'operador:tablet',
    );
    mediaService.stop();

    // Assert: refused, and the file is still there.
    expect(outcome.ok, 'the delete is refused').toBe(false);
    expect(existsSync(join(mediaFolder, computeMediaId(logo))), 'the logo stays').toBe(true);
  });
});

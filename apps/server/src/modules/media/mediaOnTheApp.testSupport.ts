// Test support: the server app with a real store and a media folder in a temporary
// folder, both removed when the test ends, and the upload as the Cadastros page sends it.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Media } from '@bajaovrlay/shared';
import { onTestFinished } from 'vitest';

import { writeSliceRows } from '../../core/db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../../core/db/temporaryDatabase.testSupport.js';
import { createServerApp } from '../../core/http/createServerApp.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from '../../core/store/createStateStore.js';

/** The app, its store and the media folder the uploads land in. */
export type AppWithAMediaFolder = {
  app: ReturnType<typeof createServerApp>;
  stateStore: StateStore;
  mediaFolder: string;
};

/** The moment every upload of these tests is stamped with: 09:00 in Brasília. */
export const momentOfTheUploads = '2026-11-14T12:00:00.000Z';

/**
 * Builds the app as production does, silent, with a new database and media folder. With
 * `earlierUploads`, the database already lists those images when the server boots, as a
 * season of uploads would leave it (their files are not written). `publicOrigins` is
 * BAJAOVRLAY_PUBLIC_ORIGINS as read at boot; none when left out.
 */
export function createAppWithAMediaFolder(
  earlierUploads?: Media,
  publicOrigins: string[] = [],
): AppWithAMediaFolder {
  const { database } = openTemporaryDatabase();
  const mediaFolder = mkdtempSync(join(tmpdir(), 'bajaovrlay-midia-'));
  onTestFinished(() => rmSync(mediaFolder, { recursive: true, force: true }));
  const logger = createLogger({ level: 'silent' });
  const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
  const storeOptions = {
    database,
    logger,
    graphicPackagesFolder,
    readCurrentTime: () => new Date(momentOfTheUploads),
  };
  if (earlierUploads !== undefined) {
    // A first boot seeds the database; the media row is then written as an older day left it.
    createStateStore(storeOptions);
    writeSliceRows(database, [
      { name: 'media', json: earlierUploads, updatedAt: momentOfTheUploads },
    ]);
  }
  const stateStore = createStateStore(storeOptions);
  const app = createServerApp({
    logger,
    version: '0.3.1',
    stateStore,
    mediaFolder,
    publicOrigins,
  });
  return { app, stateStore, mediaFolder };
}

/** Where the upload is sent to and from: the server's address, and the page's Origin. */
export type UploadAddresses = { serverAddress: string; origin: string | undefined };

/**
 * POSTs one file to /api/v1/media as the page's file input does (multipart, field
 * "file"); with `addresses`, to that server address and with that Origin header.
 */
export async function uploadFile(
  app: AppWithAMediaFolder['app'],
  bytes: Buffer,
  fileName: string,
  claimedContentType: string,
  addresses?: UploadAddresses,
): Promise<Response> {
  const form = new FormData();
  form.append('file', new File([new Uint8Array(bytes)], fileName, { type: claimedContentType }));
  const serverAddress = addresses?.serverAddress ?? 'http://localhost';
  const headers: Record<string, string> = {};
  if (addresses?.origin !== undefined) {
    headers['Origin'] = addresses.origin;
  }
  return await app.request(`${serverAddress}/api/v1/media`, {
    method: 'POST',
    body: form,
    headers,
  });
}

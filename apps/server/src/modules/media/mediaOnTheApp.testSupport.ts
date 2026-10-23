// Test support: the server app with a real store and a media folder in a temporary
// folder, both removed when the test ends, and the upload as the Cadastros page sends it.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { onTestFinished } from 'vitest';

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

/** Builds the app as production does, silent, with a new database and media folder. */
export function createAppWithAMediaFolder(): AppWithAMediaFolder {
  const { database } = openTemporaryDatabase();
  const mediaFolder = mkdtempSync(join(tmpdir(), 'bajaovrlay-midia-'));
  onTestFinished(() => rmSync(mediaFolder, { recursive: true, force: true }));
  const logger = createLogger({ level: 'silent' });
  const stateStore = createStateStore({
    database,
    logger,
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    readCurrentTime: () => new Date(momentOfTheUploads),
  });
  const app = createServerApp({ logger, version: '0.3.1', stateStore, mediaFolder });
  return { app, stateStore, mediaFolder };
}

/** POSTs one file to /api/v1/media as the page's file input does (multipart, field "file"). */
export async function uploadFile(
  app: AppWithAMediaFolder['app'],
  bytes: Buffer,
  fileName: string,
  claimedContentType: string,
): Promise<Response> {
  const form = new FormData();
  form.append('file', new File([new Uint8Array(bytes)], fileName, { type: claimedContentType }));
  return await app.request('/api/v1/media', { method: 'POST', body: form });
}

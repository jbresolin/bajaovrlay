/**
 * The limits of the media store until M4 brings logins (apps/server)
 *
 * What this module is for:
 *   Until M4, anyone on the event LAN can reach POST /api/v1/media, and each image is
 *   kept forever unless an operator deletes it. Gate 2 of PR #23 caps what uploads can do
 *   to the disk of the race-day laptop: the store holds at most 1000 images and 500 MB
 *   (answered 507 in pt-BR), no image is written when the disk would keep less than 1 GB
 *   free (507 too), and an upload sent by a page of another site is refused (403), so a
 *   web page open on the operator's own browser cannot upload behind their back.
 *
 * What these tests prove (with a real store and a temporary media folder):
 *   - With 1000 images stored, a new one is refused 507, nothing written or recorded.
 *   - An image that takes the store over 500 MB is refused 507.
 *   - The same bytes as a stored image are still accepted when the store is full: they
 *     add nothing.
 *   - An image the disk would keep less than 1 GB free after is refused 507.
 *   - An upload whose Origin is another site is refused 403; one from the server's own
 *     address, and one with no Origin (curl, Companion), are accepted.
 *
 * What these tests deliberately do not cover:
 *   - The 5 MB limit of one image and the checks of its bytes; mediaRoutes.test.ts.
 *   - Reading the free space of a real disk; the tests hand the store a reading.
 */
import { readdirSync } from 'node:fs';

import type { Media } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildPngLogo } from './imageFiles.testSupport.js';
import {
  createAppWithAMediaFolder,
  momentOfTheUploads,
  uploadFile,
} from './mediaOnTheApp.testSupport.js';
import { storeUploadedImage } from './mediaUpload.js';

const bytesPerMegabyte = 1024 * 1024;

/** A disk with plenty of room: 200 GB free. */
const readFreeBytesOfARoomyDisk = (): number => 200 * 1024 * bytesPerMegabyte;

/** `count` earlier uploads of `sizeBytes` each, as the media slice lists them. */
function buildEarlierUploads(count: number, sizeBytes: number): Media {
  const earlierUploads: Media = [];
  for (let index = 0; index < count; index += 1) {
    earlierUploads.push({
      mediaId: index.toString(16).padStart(64, '0'),
      fileName: `foto-${String(index)}.jpg`,
      contentType: 'image/jpeg',
      sizeBytes,
      widthPx: 1920,
      heightPx: 1280,
      uploadedAt: momentOfTheUploads,
    });
  }
  return earlierUploads;
}

describe('storeUploadedImage, the limits of the store', () => {
  it('refuses a new image with 1000 already stored, writing nothing', () => {
    // Arrange: a store holding 1000 small photos.
    const { stateStore, mediaFolder } = createAppWithAMediaFolder(buildEarlierUploads(1000, 20 * 1024));

    // Act: upload the logo of team 42.
    const outcome = storeUploadedImage(
      { bytes: buildPngLogo(64, 64), fileName: 'logo-ufpr.png' },
      { stateStore, mediaFolder, readFreeBytesOfTheDisk: readFreeBytesOfARoomyDisk },
    );

    // Assert: 507 in pt-BR, nothing on disk, still 1000 records.
    expect(outcome, 'a full store must answer 507').toEqual({
      isStored: false,
      httpStatus: 507,
      body: {
        error: {
          code: 'MEDIA_STORE_FULL',
          message:
            'O servidor já guarda 1000 imagens ou 500 MB; exclua imagens sem uso em Cadastros antes de enviar outra.',
        },
      },
    });
    expect(readdirSync(mediaFolder), 'nothing is written').toEqual([]);
    expect(stateStore.readAllSlices().media, 'nothing is recorded').toHaveLength(1000);
  });

  it('refuses an image that takes the store over 500 MB', () => {
    // Arrange: a store holding 100 photos of 5 MB, 500 MB in all.
    const { stateStore, mediaFolder } = createAppWithAMediaFolder(
      buildEarlierUploads(100, 5 * bytesPerMegabyte),
    );

    // Act: upload a small logo on top.
    const outcome = storeUploadedImage(
      { bytes: buildPngLogo(64, 64), fileName: 'logo-ufpr.png' },
      { stateStore, mediaFolder, readFreeBytesOfTheDisk: readFreeBytesOfARoomyDisk },
    );

    // Assert: refused as full.
    expect(outcome.isStored, 'the image must be refused').toBe(false);
    expect(
      outcome.isStored ? undefined : [outcome.httpStatus, outcome.body.error.code],
      'answered 507, store full',
    ).toEqual([507, 'MEDIA_STORE_FULL']);
  });

  it('accepts the same bytes as a stored image when the store is full', () => {
    // Arrange: a store of 999 photos, and team 42's logo stored as the 1000th.
    const { stateStore, mediaFolder } = createAppWithAMediaFolder(buildEarlierUploads(999, 20 * 1024));
    const logo = buildPngLogo(64, 64);
    const dependencies = { stateStore, mediaFolder, readFreeBytesOfTheDisk: readFreeBytesOfARoomyDisk };
    storeUploadedImage({ bytes: logo, fileName: 'logo-ufpr.png' }, dependencies);

    // Act: upload the same logo again.
    const outcome = storeUploadedImage({ bytes: logo, fileName: 'logo-ufpr.png' }, dependencies);

    // Assert: accepted; it adds nothing to the store.
    expect(outcome.isStored, 'the same bytes add nothing and are accepted').toBe(true);
    expect(stateStore.readAllSlices().media, 'still 1000 images').toHaveLength(1000);
  });

  it('refuses an image the disk would keep less than 1 GB free after', () => {
    // Arrange: an empty store on a disk with 1 GB and 100 bytes free.
    const { stateStore, mediaFolder } = createAppWithAMediaFolder();
    const readFreeBytesOfANearlyFullDisk = (): number => 1024 * bytesPerMegabyte + 100;
    const logo = buildPngLogo(256, 256);

    // Act: upload a logo larger than 100 bytes.
    const outcome = storeUploadedImage(
      { bytes: logo, fileName: 'logo-ufpr.png' },
      { stateStore, mediaFolder, readFreeBytesOfTheDisk: readFreeBytesOfANearlyFullDisk },
    );

    // Assert: 507 in pt-BR, nothing written.
    expect(logo.length, 'the logo is larger than the 100 bytes to spare').toBeGreaterThan(100);
    expect(outcome, 'a nearly full disk must answer 507').toEqual({
      isStored: false,
      httpStatus: 507,
      body: {
        error: {
          code: 'MEDIA_DISK_NEARLY_FULL',
          message:
            'O disco do servidor está quase cheio (menos de 1 GB livre); libere espaço antes de enviar imagens.',
        },
      },
    });
    expect(readdirSync(mediaFolder), 'nothing is written').toEqual([]);
  });
});

describe('POST /api/v1/media, the Origin of the upload', () => {
  const origins = [
    // The Cadastros page served by the server itself, on the LAN.
    {
      name: "accepts an upload from the server's own address",
      origin: 'http://192.168.0.10:3000',
      expectedStatus: 200,
    },
    // curl, or Companion: no browser, no Origin.
    { name: 'accepts an upload with no Origin', origin: undefined, expectedStatus: 200 },
    // A web page of another site, open in the operator's browser.
    {
      name: 'refuses an upload sent by a page of another site',
      origin: 'https://exemplo-malicioso.com.br',
      expectedStatus: 403,
    },
    // Same machine, other port: another web server, not this one.
    {
      name: 'refuses an upload from another port of the same machine',
      origin: 'http://192.168.0.10:8080',
      expectedStatus: 403,
    },
  ];

  it.each(origins)('$name', async ({ origin, expectedStatus }) => {
    // Arrange: the app, reached at http://192.168.0.10:3000.
    const { app } = createAppWithAMediaFolder();

    // Act: upload team 42's logo with the Origin of this row.
    const response = await uploadFile(app, buildPngLogo(32, 32), 'logo-ufpr.png', 'image/png', {
      serverAddress: 'http://192.168.0.10:3000',
      origin,
    });

    // Assert: the status of this row.
    expect(response.status, 'the status for this Origin').toBe(expectedStatus);
  });

  it('says in pt-BR why an upload from another site is refused', async () => {
    // Arrange: the app, reached at http://192.168.0.10:3000.
    const { app } = createAppWithAMediaFolder();

    // Act: upload from a page of another site.
    const response = await uploadFile(app, buildPngLogo(32, 32), 'logo-ufpr.png', 'image/png', {
      serverAddress: 'http://192.168.0.10:3000',
      origin: 'https://exemplo-malicioso.com.br',
    });
    const body: unknown = await response.json();

    // Assert: the pt-BR reason.
    expect(body, 'the reason names where uploads come from').toEqual({
      error: {
        code: 'MEDIA_UPLOAD_FROM_ANOTHER_SITE',
        message: 'Imagens só podem ser enviadas pela página Cadastros deste servidor.',
      },
    });
  });
});

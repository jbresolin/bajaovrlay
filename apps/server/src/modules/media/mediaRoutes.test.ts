/**
 * Uploading and serving images: POST /api/v1/media and GET /media/<mediaId> (apps/server)
 *
 * What this module is for:
 *   Logos and photos of the entity library are files under DATA_DIR/media (BAJAOVRLAY-19).
 *   The Cadastros page uploads one file at a time; the server checks it by its bytes,
 *   names it by its SHA-256 (the media id), writes it, and records it in the `media`
 *   slice through the one command path, as the actor sistema:midia. A graphic draws an
 *   image through <img> from /media/<mediaId>, which may be cached for a year because an
 *   id never changes content. An SVG can carry script, so every image is served with a
 *   Content-Security-Policy that runs nothing and with nosniff, even opened directly.
 *
 * What these tests prove (with a real store and a temporary media folder):
 *   - The route is in the OpenAPI document, its body multipart form data.
 *   - A PNG is accepted: the answer names its media id (the SHA-256), type and size, the
 *     file is on disk under that id, and the media slice and the event log record it.
 *   - A JPEG, a WebP and an SVG are accepted with their own type.
 *   - A program renamed logo.png is refused (415), and so is a 6 MB file (413), nothing
 *     written or recorded; a request with no file is refused (400).
 *   - The same file uploaded twice is one media.
 *   - GET /media/<mediaId> answers the bytes with their type, a year of cache, nosniff
 *     and the CSP; an SVG with a script is served with the same CSP.
 *   - A crafted id cannot read outside the folder, and a file in the folder that the
 *     slice does not list is not served.
 *
 * What these tests deliberately do not cover:
 *   - Telling the formats apart byte by byte; imageContent.test.ts.
 *   - Deleting media; mediaCommands.test.ts and mediaFileRemoval.test.ts.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildJpegCarPhoto,
  buildPngLogo,
  buildPngOfSize,
  buildProgramRenamedAsAPng,
  buildSvgLogoWithScript,
  buildSvgSponsorLogo,
  buildWebpSponsorLogo,
} from './imageFiles.testSupport.js';
import {
  createAppWithAMediaFolder,
  momentOfTheUploads,
  uploadFile,
} from './mediaOnTheApp.testSupport.js';

/** The Content-Security-Policy every image is served with (BAJAOVRLAY-19). */
const contentSecurityPolicyOfImages = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

/** The media id of some bytes: their SHA-256 in hexadecimal. */
function computeMediaId(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('POST /api/v1/media', () => {
  it('accepts a PNG, writes it under its media id and records it', async () => {
    // Arrange: the app, and the 256×128 logo of team 42.
    const { app, stateStore, mediaFolder } = createAppWithAMediaFolder();
    const logo = buildPngLogo(256, 128);

    // Act: upload it as logo-ufpr.png.
    const response = await uploadFile(app, logo, 'logo-ufpr.png', 'image/png');
    const body: unknown = await response.json();

    // Assert: answered with the id, type and size; on disk; in the slice; in the log.
    const expectedMediaId = computeMediaId(logo);
    expect(response.status, 'the upload must answer 200').toBe(200);
    expect(body, 'the answer names the media id, the type and the size').toEqual({
      mediaId: expectedMediaId,
      contentType: 'image/png',
      widthPx: 256,
      heightPx: 128,
    });
    expect(existsSync(join(mediaFolder, expectedMediaId)), 'the file is on disk').toBe(true);
    expect(stateStore.readAllSlices().media, 'the media slice records it').toEqual([
      {
        mediaId: expectedMediaId,
        fileName: 'logo-ufpr.png',
        contentType: 'image/png',
        sizeBytes: logo.length,
        widthPx: 256,
        heightPx: 128,
        uploadedAt: momentOfTheUploads,
      },
    ]);
    const lastRow = stateStore.readAllSlices().eventLog.at(-1);
    expect([lastRow?.actor, lastRow?.command], 'logged by the media store').toEqual([
      'sistema:midia',
      'recordUploadedMedia',
    ]);
  });

  const otherAcceptedImages = [
    // A car photo from a phone.
    {
      name: 'accepts a JPEG',
      bytes: buildJpegCarPhoto(1920, 1280),
      fileName: 'carro-42.jpg',
      expectedContentType: 'image/jpeg',
    },
    // A sponsor logo saved from a website.
    {
      name: 'accepts a WebP',
      bytes: buildWebpSponsorLogo(600, 200),
      fileName: 'serra-azul.webp',
      expectedContentType: 'image/webp',
    },
    // A vector logo.
    {
      name: 'accepts an SVG',
      bytes: buildSvgSponsorLogo(),
      fileName: 'serra-azul.svg',
      expectedContentType: 'image/svg+xml',
    },
  ];

  it.each(otherAcceptedImages)('$name', async ({ bytes, fileName, expectedContentType }) => {
    // Arrange: the app.
    const { app } = createAppWithAMediaFolder();

    // Act: upload the file of this row, claiming nothing about its type.
    const response = await uploadFile(app, bytes, fileName, 'application/octet-stream');
    const body = (await response.json()) as { contentType?: string };

    // Assert: accepted with the type its bytes say.
    expect(response.status, 'the upload must answer 200').toBe(200);
    expect(body.contentType, 'the type comes from the bytes').toBe(expectedContentType);
  });

  it('refuses a program renamed logo.png, writing and recording nothing', async () => {
    // Arrange: the app, and a Windows program named like a logo.
    const { app, stateStore, mediaFolder } = createAppWithAMediaFolder();

    // Act: upload it, the browser even claiming it is a PNG.
    const response = await uploadFile(app, buildProgramRenamedAsAPng(), 'logo.png', 'image/png');
    const body: unknown = await response.json();

    // Assert: 415 in pt-BR, the folder empty, the slice empty.
    expect(response.status, 'a file that is not an image must answer 415').toBe(415);
    expect(body, 'the reason names the file in pt-BR').toEqual({
      error: {
        code: 'MEDIA_TYPE_NOT_ACCEPTED',
        message: 'O arquivo "logo.png" não é uma imagem PNG, JPEG, WebP ou SVG.',
      },
    });
    expect(readdirSync(mediaFolder), 'nothing is written').toEqual([]);
    expect(stateStore.readAllSlices().media, 'nothing is recorded').toEqual([]);
  });

  it('refuses a 6 MB file, writing nothing', async () => {
    // Arrange: the app, and a 6 MB photo straight off a camera.
    const { app, mediaFolder } = createAppWithAMediaFolder();
    const sixMegabyteFile = buildPngOfSize(6 * 1024 * 1024);

    // Act: upload it.
    const response = await uploadFile(app, sixMegabyteFile, 'foto-do-carro.png', 'image/png');
    const body: unknown = await response.json();

    // Assert: 413 in pt-BR, and nothing written.
    expect(response.status, 'a file over 5 MB must answer 413').toBe(413);
    expect(body, 'the reason states the limit in pt-BR').toEqual({
      error: {
        code: 'MEDIA_TOO_LARGE',
        message: 'A imagem passa de 5 MB; reduza-a antes de enviar.',
      },
    });
    expect(readdirSync(mediaFolder), 'nothing is written').toEqual([]);
  });

  it('refuses a request that carries no file', async () => {
    // Arrange: the app, and a form with a text field only.
    const { app } = createAppWithAMediaFolder();
    const form = new FormData();
    form.append('nome', 'logo-ufpr.png');

    // Act: post it.
    const response = await app.request('/api/v1/media', { method: 'POST', body: form });
    const body: unknown = await response.json();

    // Assert: 400 in pt-BR.
    expect(response.status, 'no file must answer 400').toBe(400);
    expect(body, 'the reason says to send one file').toEqual({
      error: {
        code: 'MEDIA_FILE_MISSING',
        message: 'Envie um arquivo de imagem no campo "file".',
      },
    });
  });

  it('is described in the OpenAPI document, with its multipart body', async () => {
    // Arrange: the app.
    const { app } = createAppWithAMediaFolder();

    // Act: read the generated document, as Companion's author would.
    const response = await app.request('/api/v1/openapi.json');
    const document = (await response.json()) as {
      paths: Record<string, { post?: { requestBody?: { content?: Record<string, unknown> } } }>;
    };

    // Assert: the route is there, with its multipart body.
    const uploadRoute = document.paths['/media']?.post;
    expect(response.status, 'the document must be generated').toBe(200);
    expect(
      Object.keys(uploadRoute?.requestBody?.content ?? {}),
      'the upload is described as multipart form data',
    ).toEqual(['multipart/form-data']);
  });

  it('keeps one media for the same file uploaded twice', async () => {
    // Arrange: the app, and the logo of team 42.
    const { app, stateStore } = createAppWithAMediaFolder();
    const logo = buildPngLogo(64, 64);

    // Act: upload it twice, under two names.
    const firstBody = (await (await uploadFile(app, logo, 'logo.png', 'image/png')).json()) as {
      mediaId: string;
    };
    const secondResponse = await uploadFile(app, logo, 'logo-copia.png', 'image/png');
    const secondBody = (await secondResponse.json()) as { mediaId: string };

    // Assert: the same id both times, and one record, under the first name.
    expect(secondResponse.status, 'the second upload is answered 200').toBe(200);
    expect(secondBody.mediaId, 'the same bytes are the same media').toBe(firstBody.mediaId);
    expect(
      stateStore.readAllSlices().media.map((media) => media.fileName),
      'one record',
    ).toEqual(['logo.png']);
  });
});

describe('GET /media/<mediaId>', () => {
  it('answers the bytes with their type, a year of cache, nosniff and the CSP', async () => {
    // Arrange: the logo of team 42 uploaded.
    const { app } = createAppWithAMediaFolder();
    const logo = buildPngLogo(32, 32);
    await uploadFile(app, logo, 'logo-ufpr.png', 'image/png');

    // Act: fetch it as a graphic's <img> does.
    const response = await app.request(`/media/${computeMediaId(logo)}`);
    const bytesServed = Buffer.from(await response.arrayBuffer());

    // Assert: the same bytes, the type, the year of cache and the two safety headers.
    expect(response.status, 'the image must answer 200').toBe(200);
    expect(bytesServed.equals(logo), 'the bytes must be the ones uploaded').toBe(true);
    expect(response.headers.get('content-type'), 'the type recorded').toBe('image/png');
    expect(response.headers.get('cache-control'), 'an id never changes content').toBe(
      'public, max-age=31536000, immutable',
    );
    expect(response.headers.get('x-content-type-options'), 'no sniffing').toBe('nosniff');
    expect(response.headers.get('content-security-policy'), 'nothing runs').toBe(
      contentSecurityPolicyOfImages,
    );
  });

  it('serves an SVG that carries a script with the CSP that runs nothing', async () => {
    // Arrange: an SVG logo with a script inside, uploaded.
    const { app } = createAppWithAMediaFolder();
    const svgWithScript = buildSvgLogoWithScript();
    await uploadFile(app, svgWithScript, 'logo-malicioso.svg', 'image/svg+xml');

    // Act: open its address directly, as someone pasting it into a browser would.
    const response = await app.request(`/media/${computeMediaId(svgWithScript)}`);

    // Assert: served as an SVG, with the sandboxing CSP and nosniff.
    expect(response.headers.get('content-type'), 'served as SVG').toBe('image/svg+xml');
    expect(
      response.headers.get('content-security-policy'),
      'the CSP must forbid every script and sandbox the page',
    ).toBe(contentSecurityPolicyOfImages);
    expect(response.headers.get('x-content-type-options'), 'no sniffing').toBe('nosniff');
  });

  const craftedAddresses = [
    // Climbing out of the folder with encoded slashes, towards the database.
    {
      name: 'refuses an id that climbs out with encoded slashes',
      path: '/media/..%2F..%2Fbajaovrlay.sqlite',
    },
    // Climbing out with plain dots.
    { name: 'refuses an id of two dots', path: '/media/..' },
    // An upper-case id is not one the store makes.
    { name: 'refuses an id in capitals', path: `/media/${'A'.repeat(64)}` },
  ];

  it.each(craftedAddresses)('$name', async ({ path }) => {
    // Arrange: the app with one image uploaded.
    const { app } = createAppWithAMediaFolder();
    await uploadFile(app, buildPngLogo(8, 8), 'logo.png', 'image/png');

    // Act: ask for the crafted address.
    const response = await app.request(path);

    // Assert: not found, in JSON.
    expect(response.status, 'a crafted id must answer 404').toBe(404);
    expect(response.headers.get('content-type'), 'answered in JSON').toContain('application/json');
  });

  it('does not serve a file of the folder that the media slice does not list', async () => {
    // Arrange: a file written into the media folder by hand, under a well-formed id.
    const { app, mediaFolder } = createAppWithAMediaFolder();
    const strayFileId = 'b'.repeat(64);
    writeFileSync(join(mediaFolder, strayFileId), buildPngLogo(8, 8));

    // Act: ask for it.
    const response = await app.request(`/media/${strayFileId}`);

    // Assert: not found; only recorded media is served, with the type recorded for it.
    expect(response.status, 'an unrecorded file must answer 404').toBe(404);
  });
});

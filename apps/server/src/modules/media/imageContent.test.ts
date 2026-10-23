/**
 * What an uploaded file really is, read from its bytes (apps/server)
 *
 * What this module is for:
 *   The media store accepts PNG, JPEG, WebP and SVG images only, and decides by the
 *   file's own bytes, never by its name: a program renamed logo.png is still a program
 *   (BAJAOVRLAY-19). It also reads the image's width and height from its header, which
 *   the upload answers and the Cadastros page shows, without decoding the image.
 *
 * What these tests prove:
 *   - A PNG, a JPEG, a lossless WebP and an SVG (with an XML declaration, or with only a
 *     viewBox) are recognised, with the size their header gives.
 *   - A program renamed as a PNG, a GIF, a plain text file and an HTML page that holds an
 *     SVG are refused as not an accepted image.
 *   - An SVG that gives no size at all, and a PNG cut off before its header ends, are
 *     refused as images whose size cannot be read.
 *
 * What these tests deliberately do not cover:
 *   - The 5 MB limit and the route's answers; mediaRoutes.test.ts.
 *   - Whether an image decodes; the browser does that, and a broken one shows no picture.
 */
import { describe, expect, it } from 'vitest';

import { readImageContent } from './imageContent.js';
import {
  buildJpegCarPhoto,
  buildPngLogo,
  buildProgramRenamedAsAPng,
  buildSvgSponsorLogo,
  buildWebpSponsorLogo,
} from './imageFiles.testSupport.js';

describe('readImageContent', () => {
  const acceptedImages = [
    // A team logo exported from a design tool.
    {
      name: 'reads a PNG and its size',
      bytes: buildPngLogo(256, 128),
      expected: { contentType: 'image/png', widthPx: 256, heightPx: 128 },
    },
    // A car photo from a phone.
    {
      name: 'reads a JPEG and its size from the frame header',
      bytes: buildJpegCarPhoto(1920, 1280),
      expected: { contentType: 'image/jpeg', widthPx: 1920, heightPx: 1280 },
    },
    // A sponsor logo from a website, lossless WebP.
    {
      name: 'reads a lossless WebP and its size',
      bytes: buildWebpSponsorLogo(600, 200),
      expected: { contentType: 'image/webp', widthPx: 600, heightPx: 200 },
    },
    // A vector logo with an XML declaration and both sizes.
    {
      name: 'reads an SVG with an XML declaration and its width and height',
      bytes: buildSvgSponsorLogo(),
      expected: { contentType: 'image/svg+xml', widthPx: 320, heightPx: 120 },
    },
    // Many vector logos give only a viewBox; its width and height are the size.
    {
      name: 'reads the size of an SVG from its viewBox',
      bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 256"></svg>'),
      expected: { contentType: 'image/svg+xml', widthPx: 512, heightPx: 256 },
    },
    // A size in px is a size; the unit is the default one.
    {
      name: 'reads an SVG size written in px',
      bytes: Buffer.from('<svg width="200px" height="80px" viewBox="0 0 50 20"></svg>'),
      expected: { contentType: 'image/svg+xml', widthPx: 200, heightPx: 80 },
    },
  ];

  it.each(acceptedImages)('$name', ({ bytes, expected }) => {
    // Arrange: the bytes of this row.

    // Act: read what they are.
    const content = readImageContent(bytes);

    // Assert: the type and the size the header gives.
    expect(content, 'the image must be recognised with its size').toEqual({
      isReadable: true,
      ...expected,
    });
  });

  const refusedFiles = [
    // The attack the brief names: a program with an image's name.
    {
      name: 'refuses a program renamed as a PNG',
      bytes: buildProgramRenamedAsAPng(),
      expectedProblem: 'notAnAcceptedImage',
    },
    // GIF is an image, but not one of the four accepted kinds.
    {
      name: 'refuses a GIF',
      bytes: Buffer.from('GIF89a\u0001\u0000\u0001\u0000\u0000\u0000\u0000;', 'latin1'),
      expectedProblem: 'notAnAcceptedImage',
    },
    // A text file is no image, whatever its name says.
    {
      name: 'refuses a plain text file',
      bytes: Buffer.from('Equipe 42 — Baja UFPR\n', 'utf8'),
      expectedProblem: 'notAnAcceptedImage',
    },
    // An HTML page with an SVG inside it is a page, and a page can run script.
    {
      name: 'refuses an HTML page that holds an SVG',
      bytes: Buffer.from('<html><body><svg viewBox="0 0 10 10"></svg></body></html>'),
      expectedProblem: 'notAnAcceptedImage',
    },
    // An SVG with neither width, height nor viewBox has no size to answer.
    {
      name: 'refuses an SVG that gives no size',
      bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>'),
      expectedProblem: 'sizeUnreadable',
    },
    // A PNG cut off in the middle of its header (an upload that broke).
    {
      name: 'refuses a PNG cut off before its size',
      bytes: buildPngLogo(256, 128).subarray(0, 18),
      expectedProblem: 'sizeUnreadable',
    },
  ];

  it.each(refusedFiles)('$name', ({ bytes, expectedProblem }) => {
    // Arrange: the bytes of this row.

    // Act: read what they are.
    const content = readImageContent(bytes);

    // Assert: refused, for the reason of this row.
    expect(content, 'the file must be refused for this reason').toEqual({
      isReadable: false,
      problem: expectedProblem,
    });
  });
});

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
 *     refused as images whose size cannot be read; so are malformed JPEG headers (cut
 *     off, a length past the end or of 0, a scan before the frame, 0 by 0) and malformed
 *     WebP headers (no first chunk, no signature byte, no start code, an unknown chunk),
 *     each without reading past the end (gate 2 of PR #23).
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

/** A lossy WebP ("VP8 ") whose three start-code bytes are zeros instead of 9D 01 2A. */
function buildLossyWebpWithoutItsStartCode(): Buffer {
  const bytes = Buffer.alloc(30);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(22, 4);
  bytes.write('WEBP', 8, 'ascii');
  bytes.write('VP8 ', 12, 'ascii');
  bytes.writeUInt32LE(10, 16);
  bytes.writeUInt16LE(600, 26);
  bytes.writeUInt16LE(200, 28);
  return bytes;
}

/** A WebP whose first chunk is "ICCP" (a colour profile), which carries no size. */
function buildWebpWithAnUnknownFirstChunk(): Buffer {
  const bytes = Buffer.alloc(30);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(22, 4);
  bytes.write('WEBP', 8, 'ascii');
  bytes.write('ICCP', 12, 'ascii');
  bytes.writeUInt32LE(10, 16);
  return bytes;
}

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
    // Malformed JPEG headers (gate 2 of PR #23): each must be refused, never read past
    // its end, never loop.
    // The frame header cut off after its marker: the size bytes are missing.
    {
      name: 'refuses a JPEG cut off inside its frame header',
      bytes: buildJpegCarPhoto(1920, 1280).subarray(0, 24),
      expectedProblem: 'sizeUnreadable',
    },
    // A segment whose length points far past the end of the file.
    {
      name: 'refuses a JPEG whose segment length runs past the end',
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xf0, 0x4a, 0x46, 0x49, 0x46]),
      expectedProblem: 'sizeUnreadable',
    },
    // A segment of length 0, which would make a careless walk stand still.
    {
      name: 'refuses a JPEG with a segment of length 0',
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
      expectedProblem: 'sizeUnreadable',
    },
    // The scan starts before any frame header: there is no size to read.
    {
      name: 'refuses a JPEG whose scan starts before its frame header',
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00]),
      expectedProblem: 'sizeUnreadable',
    },
    // A frame header that says 0 × 0.
    {
      name: 'refuses a JPEG whose frame header says 0 by 0',
      bytes: buildJpegCarPhoto(0, 0),
      expectedProblem: 'sizeUnreadable',
    },
    // Malformed WebP headers (gate 2 of PR #23).
    // RIFF and WEBP, then nothing: the first chunk is missing.
    {
      name: 'refuses a WebP cut off after its RIFF header',
      bytes: buildWebpSponsorLogo(600, 200).subarray(0, 14),
      expectedProblem: 'sizeUnreadable',
    },
    // A lossless chunk without its signature byte.
    {
      name: 'refuses a lossless WebP without its signature byte',
      bytes: Buffer.concat([
        buildWebpSponsorLogo(600, 200).subarray(0, 20),
        Buffer.from([0x00, 0x57, 0x02, 0x32, 0x00]),
      ]),
      expectedProblem: 'sizeUnreadable',
    },
    // A lossy chunk whose start code is wrong.
    {
      name: 'refuses a lossy WebP without its start code',
      bytes: buildLossyWebpWithoutItsStartCode(),
      expectedProblem: 'sizeUnreadable',
    },
    // A first chunk of a kind WebP does not have.
    {
      name: 'refuses a WebP whose first chunk is of no known kind',
      bytes: buildWebpWithAnUnknownFirstChunk(),
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

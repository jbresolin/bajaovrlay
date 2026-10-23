// Test support: small image files as an operator would upload them, built byte by byte
// so a reader sees what each format's header holds. The PNG is a real, decodable image
// (the browser tests show it as a thumbnail); the JPEG and WebP carry real headers with
// a stand-in body, enough for the sniffing and the size reading.
import { crc32, deflateSync } from 'node:zlib';

/** One PNG chunk: length, type, data, and the CRC over type and data. */
function buildPngChunk(chunkType: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(chunkType, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

/**
 * A real PNG of the given size, every pixel the brand blue (#1E3A8A), RGBA: the logo of
 * team 42 as a test sees it.
 */
export function buildPngLogo(widthPx: number, heightPx: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(widthPx, 0);
  header.writeUInt32BE(heightPx, 4);
  header.writeUInt8(8, 8); // 8 bits per channel
  header.writeUInt8(6, 9); // RGBA
  const oneRow = Buffer.alloc(1 + widthPx * 4);
  for (let pixel = 0; pixel < widthPx; pixel += 1) {
    oneRow.set([0x1e, 0x3a, 0x8a, 0xff], 1 + pixel * 4);
  }
  const rows = Buffer.concat(Array.from({ length: heightPx }, () => oneRow));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    buildPngChunk('IHDR', header),
    buildPngChunk('IDAT', deflateSync(rows)),
    buildPngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * A JPEG's header as a camera writes it: start of image, a JFIF segment, then the
 * baseline frame header (SOF0) that holds the height and the width, and the end.
 */
export function buildJpegCarPhoto(widthPx: number, heightPx: number): Buffer {
  const startOfImage = Buffer.from([0xff, 0xd8]);
  const jfifSegment = Buffer.from([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01,
    0x00, 0x00,
  ]);
  const frameHeader = Buffer.alloc(19);
  frameHeader.set([0xff, 0xc0, 0x00, 0x11, 0x08], 0);
  frameHeader.writeUInt16BE(heightPx, 5);
  frameHeader.writeUInt16BE(widthPx, 7);
  frameHeader.set([0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01], 9);
  const endOfImage = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([startOfImage, jfifSegment, frameHeader, endOfImage]);
}

/** A lossless WebP (VP8L) header: RIFF, WEBP, then width − 1 and height − 1 in 14 bits each. */
export function buildWebpSponsorLogo(widthPx: number, heightPx: number): Buffer {
  const sizeBits = (widthPx - 1) | ((heightPx - 1) << 14);
  const vp8lData = Buffer.alloc(5);
  vp8lData.writeUInt8(0x2f, 0); // the VP8L signature byte
  vp8lData.writeUInt32LE(sizeBits, 1);
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.write('VP8L', 0, 'ascii');
  chunkHeader.writeUInt32LE(vp8lData.length, 4);
  const riffHeader = Buffer.alloc(12);
  riffHeader.write('RIFF', 0, 'ascii');
  riffHeader.writeUInt32LE(4 + chunkHeader.length + vp8lData.length, 4);
  riffHeader.write('WEBP', 8, 'ascii');
  return Buffer.concat([riffHeader, chunkHeader, vp8lData]);
}

/** A sponsor's SVG logo with a width and a height, after an XML declaration. */
export function buildSvgSponsorLogo(): Buffer {
  return Buffer.from(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120" viewBox="0 0 320 120">',
      '  <rect width="320" height="120" fill="#0F766E"/>',
      '  <text x="20" y="72" font-size="40" fill="#FFFFFF">Serra Azul</text>',
      '</svg>',
    ].join('\n'),
    'utf8',
  );
}

/**
 * An SVG that tries to run script when opened: what an attacker would upload as a logo.
 * It must still be accepted (it is an SVG) but never run anything when served.
 */
export function buildSvgLogoWithScript(): Buffer {
  return Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><script>alert(1)</script></svg>',
    'utf8',
  );
}

/** A Windows program renamed to logo.png: "MZ", the DOS header, and nothing of an image. */
export function buildProgramRenamedAsAPng(): Buffer {
  const program = Buffer.alloc(512);
  program.write('MZ', 0, 'ascii');
  program.write('This program cannot be run in DOS mode.', 78, 'ascii');
  return program;
}

/** A PNG header followed by padding up to `sizeInBytes`: a photo straight off a camera. */
export function buildPngOfSize(sizeInBytes: number): Buffer {
  const smallPng = buildPngLogo(4, 4);
  return Buffer.concat([smallPng, Buffer.alloc(sizeInBytes - smallPng.length)]);
}

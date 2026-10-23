// What an uploaded file is, decided by its bytes alone, and its size in pixels.
import type { AcceptedImageContentType } from '@bajaovrlay/shared';

import {
  type ImageSize,
  pngSignature,
  readJpegSize,
  readPngSize,
  readWebpSize,
} from './rasterImageSizes.js';
import { findSvgRootStartTag, readSvgSize } from './svgImageSize.js';

/**
 * What reading a file gives: an accepted image with its type and size, or why not:
 * `notAnAcceptedImage` (not a PNG, JPEG, WebP or SVG) or `sizeUnreadable` (one of them,
 * but its header is cut off, or an SVG that gives no size).
 */
export type ImageContent =
  | ({ isReadable: true; contentType: AcceptedImageContentType } & ImageSize)
  | { isReadable: false; problem: 'notAnAcceptedImage' | 'sizeUnreadable' };

/**
 * Tells which of the four accepted images the bytes are, by their own first bytes (the
 * magic numbers of PNG, JPEG and WebP; for an SVG, a UTF-8 text whose root element is
 * <svg>), never by the file's name or the type the browser claimed, so a program renamed
 * logo.png is refused (BAJAOVRLAY-19). Then reads the size from the header.
 */
export function readImageContent(bytes: Buffer): ImageContent {
  const contentType = recogniseAcceptedImageType(bytes);
  if (contentType === undefined) {
    return { isReadable: false, problem: 'notAnAcceptedImage' };
  }
  const size = readSizeOfImage(bytes, contentType);
  if (size === undefined) {
    return { isReadable: false, problem: 'sizeUnreadable' };
  }
  return { isReadable: true, contentType, ...size };
}

/** Which accepted type the first bytes say, or undefined for anything else. */
function recogniseAcceptedImageType(bytes: Buffer): AcceptedImageContentType | undefined {
  if (bytes.subarray(0, 8).equals(pngSignature)) {
    return 'image/png';
  }
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (isJpeg) {
    return 'image/jpeg';
  }
  const isWebp =
    bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (isWebp) {
    return 'image/webp';
  }
  if (findSvgRootStartTag(bytes) !== undefined) {
    return 'image/svg+xml';
  }
  return undefined;
}

/** The size of an image of a known type, read from its header. */
function readSizeOfImage(
  bytes: Buffer,
  contentType: AcceptedImageContentType,
): ImageSize | undefined {
  switch (contentType) {
    case 'image/png':
      return readPngSize(bytes);
    case 'image/jpeg':
      return readJpegSize(bytes);
    case 'image/webp':
      return readWebpSize(bytes);
    case 'image/svg+xml': {
      const rootStartTag = findSvgRootStartTag(bytes);
      return rootStartTag === undefined ? undefined : readSvgSize(rootStartTag);
    }
  }
}

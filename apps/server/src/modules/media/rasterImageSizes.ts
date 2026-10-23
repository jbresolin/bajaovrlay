// Reading the width and height of a PNG, a JPEG or a WebP from its header, without
// decoding the image. Each reader answers undefined when the header is cut off or holds
// something else, and never throws: the bytes come from whoever uploaded them.

/** A width and a height in pixels, both whole numbers above 0. */
export type ImageSize = { widthPx: number; heightPx: number };

/** The eight bytes every PNG starts with. */
export const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * A PNG's size: its first chunk is always IHDR (bytes 12 to 15), whose data starts with
 * the width and then the height, each a 4-byte big-endian number.
 */
export function readPngSize(bytes: Buffer): ImageSize | undefined {
  const isHeaderComplete = bytes.length >= 24;
  if (!isHeaderComplete || bytes.toString('ascii', 12, 16) !== 'IHDR') {
    return undefined;
  }
  return keepOnlyPositiveSize(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
}

// The JPEG frame headers that carry the size: SOF0 to SOF15, except DHT (C4), JPG (C8)
// and DAC (CC), which share the range but are other segments.
const jpegFrameHeaderMarkers = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
// Markers that stand alone, with no length after them: TEM and RST0 to RST7.
const jpegMarkersWithoutLength = new Set([0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7]);
const jpegStartOfScanMarker = 0xda;

/**
 * A JPEG's size: after the start-of-image marker, segments follow one another, each
 * 0xFF, a marker byte and (for most) a 2-byte length; the frame header (SOF) holds the
 * height and then the width. The walk stops at the start of the scan, after which come
 * the compressed pixels and no size.
 */
export function readJpegSize(bytes: Buffer): ImageSize | undefined {
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      return undefined;
    }
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xff) {
      // A fill byte: the marker is the next byte.
      offset += 1;
      continue;
    }
    if (jpegMarkersWithoutLength.has(marker)) {
      offset += 2;
      continue;
    }
    if (marker === jpegStartOfScanMarker) {
      return undefined;
    }
    if (jpegFrameHeaderMarkers.has(marker)) {
      const isFrameHeaderComplete = offset + 9 <= bytes.length;
      if (!isFrameHeaderComplete) {
        return undefined;
      }
      return keepOnlyPositiveSize(bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5));
    }
    const segmentLength = bytes.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }
  return undefined;
}

/**
 * A WebP's size, by its first chunk: VP8L (lossless: width − 1 and height − 1 in 14 bits
 * each after a signature byte), VP8X (extended: width − 1 and height − 1 in 3 bytes each)
 * or "VP8 " (lossy: after a 3-byte start code, width and height in 14 bits each).
 */
export function readWebpSize(bytes: Buffer): ImageSize | undefined {
  if (bytes.length < 16) {
    return undefined;
  }
  const firstChunkType = bytes.toString('ascii', 12, 16);
  if (firstChunkType === 'VP8L') {
    if (bytes.length < 25 || bytes[20] !== 0x2f) {
      return undefined;
    }
    const sizeBits = bytes.readUInt32LE(21);
    const widthPx = (sizeBits & 0x3fff) + 1;
    const heightPx = ((sizeBits >> 14) & 0x3fff) + 1;
    return { widthPx, heightPx };
  }
  if (bytes.length < 30) {
    return undefined;
  }
  if (firstChunkType === 'VP8X') {
    return { widthPx: bytes.readUIntLE(24, 3) + 1, heightPx: bytes.readUIntLE(27, 3) + 1 };
  }
  if (firstChunkType === 'VP8 ') {
    const hasStartCode = bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a;
    if (!hasStartCode) {
      return undefined;
    }
    return keepOnlyPositiveSize(bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff);
  }
  return undefined;
}

/** The size, or undefined when a side is 0 (a header that says nothing). */
function keepOnlyPositiveSize(widthPx: number, heightPx: number): ImageSize | undefined {
  if (widthPx <= 0 || heightPx <= 0) {
    return undefined;
  }
  return { widthPx, heightPx };
}

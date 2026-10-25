/**
 * Test support: the characters a WOFF2 font draws, read from its cmap table, so a test can
 * prove the on-air face covers every pt-BR character (BAJAOVRLAY-46, gate 2 of PR #28).
 * Written here, from the W3C WOFF2 and the OpenType cmap specifications, rather than added
 * as a font library: the tests need one table of one file.
 *
 * The steps, in the order of the file:
 *   1. The 48-byte WOFF2 header says how many tables there are and how long the
 *      compressed block is.
 *   2. The table directory lists each table: its tag and its length in the block.
 *   3. The block, after the directory, is every table one after the other, compressed with
 *      Brotli as one stream; the cmap table is found by adding up the lengths before it.
 *   4. The cmap table holds subtables; a Windows Unicode one (format 12, or else format 4)
 *      gives the code points that map to a real glyph (glyph 0 means "missing").
 *
 * What could go wrong: a WOFF2 collection (several fonts in one file), or a font with only a
 * Mac or symbol cmap, is refused with an error rather than read wrongly.
 */
import { brotliDecompressSync } from 'node:zlib';

/** Where the WOFF2 table directory starts: right after the fixed 48-byte header. */
const woff2HeaderLength = 48;

/** The WOFF2 directory's index of the cmap tag among its known tags (the spec's table). */
const knownTagIndexOfCmap = 0;
/** The indexes of glyf and loca, the two tables whose "transform 0" means transformed. */
const knownTagIndexOfGlyf = 10;
const knownTagIndexOfLoca = 11;
/** A tag index of 63 means the four-letter tag itself follows in the directory. */
const tagIndexOfAnArbitraryTag = 63;

/** One entry of the table directory, as far as finding a table needs. */
type TableEntry = { isCmap: boolean; lengthInTheBlock: number };

/** A reader that walks a byte array from a position, as the WOFF2 directory is read. */
class ByteCursor {
  constructor(
    private readonly bytes: DataView,
    public position: number,
  ) {}

  readUint8(): number {
    const value = this.bytes.getUint8(this.position);
    this.position += 1;
    return value;
  }

  /** WOFF2's UIntBase128: seven bits a byte, high bit set on every byte but the last. */
  readUIntBase128(): number {
    let value = 0;
    for (let byteCount = 0; byteCount < 5; byteCount += 1) {
      const byte = this.readUint8();
      value = value * 128 + (byte & 0x7f);
      const isLastByte = (byte & 0x80) === 0;
      if (isLastByte) {
        return value;
      }
    }
    throw new Error('a UIntBase128 in the WOFF2 directory is longer than five bytes');
  }
}

/** Steps 1 and 2: the table directory, each table's tag kind and its length in the block. */
function readTableDirectory(file: DataView): { tables: TableEntry[]; endOfDirectory: number } {
  const signature = file.getUint32(0);
  const flavor = file.getUint32(4);
  if (signature !== 0x774f4632 /* 'wOF2' */) {
    throw new Error('not a WOFF2 file');
  }
  if (flavor === 0x74746366 /* 'ttcf' */) {
    throw new Error('a WOFF2 collection is not read here');
  }
  const tableCount = file.getUint16(12);
  const cursor = new ByteCursor(file, woff2HeaderLength);
  const tables: TableEntry[] = [];
  for (let tableNumber = 0; tableNumber < tableCount; tableNumber += 1) {
    const flags = cursor.readUint8();
    const tagIndex = flags & 0x3f;
    const transformVersion = flags >> 6;
    if (tagIndex === tagIndexOfAnArbitraryTag) {
      cursor.position += 4;
    }
    const originalLength = cursor.readUIntBase128();
    const isGlyfOrLoca = tagIndex === knownTagIndexOfGlyf || tagIndex === knownTagIndexOfLoca;
    const isTransformed = isGlyfOrLoca ? transformVersion === 0 : transformVersion !== 0;
    const lengthInTheBlock = isTransformed ? cursor.readUIntBase128() : originalLength;
    tables.push({ isCmap: tagIndex === knownTagIndexOfCmap, lengthInTheBlock });
  }
  return { tables, endOfDirectory: cursor.position };
}

/** Step 3: the cmap table's bytes, out of the decompressed block. */
function readCmapTable(fileBytes: Uint8Array): DataView {
  const file = new DataView(fileBytes.buffer, fileBytes.byteOffset, fileBytes.byteLength);
  const { tables, endOfDirectory } = readTableDirectory(file);
  const compressedLength = file.getUint32(20);
  const compressedBlock = fileBytes.subarray(endOfDirectory, endOfDirectory + compressedLength);
  const block = brotliDecompressSync(compressedBlock);
  let offsetInTheBlock = 0;
  for (const table of tables) {
    if (table.isCmap) {
      return new DataView(
        block.buffer,
        block.byteOffset + offsetInTheBlock,
        table.lengthInTheBlock,
      );
    }
    offsetInTheBlock += table.lengthInTheBlock;
  }
  throw new Error('the font has no cmap table');
}

/** Step 4, format 12: groups of consecutive code points mapped to consecutive glyphs. */
function readFormat12(subtable: DataView, codePoints: Set<number>): void {
  const groupCount = subtable.getUint32(12);
  for (let groupNumber = 0; groupNumber < groupCount; groupNumber += 1) {
    const groupStart = 16 + groupNumber * 12;
    const firstCodePoint = subtable.getUint32(groupStart);
    const lastCodePoint = subtable.getUint32(groupStart + 4);
    const firstGlyph = subtable.getUint32(groupStart + 8);
    for (let codePoint = firstCodePoint; codePoint <= lastCodePoint; codePoint += 1) {
      const glyph = firstGlyph + (codePoint - firstCodePoint);
      if (glyph !== 0) {
        codePoints.add(codePoint);
      }
    }
  }
}

/** Step 4, format 4: segments of the Basic Multilingual Plane, each with its glyph rule. */
function readFormat4(subtable: DataView, codePoints: Set<number>): void {
  const segmentCount = subtable.getUint16(6) / 2;
  const endCodesStart = 14;
  const startCodesStart = endCodesStart + segmentCount * 2 + 2;
  const idDeltasStart = startCodesStart + segmentCount * 2;
  const idRangeOffsetsStart = idDeltasStart + segmentCount * 2;
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const endCode = subtable.getUint16(endCodesStart + segment * 2);
    const startCode = subtable.getUint16(startCodesStart + segment * 2);
    const idDelta = subtable.getInt16(idDeltasStart + segment * 2);
    const idRangeOffsetPosition = idRangeOffsetsStart + segment * 2;
    const idRangeOffset = subtable.getUint16(idRangeOffsetPosition);
    for (let codePoint = startCode; codePoint <= endCode && codePoint !== 0xffff; codePoint += 1) {
      let glyph: number;
      if (idRangeOffset === 0) {
        glyph = (codePoint + idDelta) & 0xffff;
      } else {
        // The spec's rule: the glyph index sits idRangeOffset bytes past this very entry.
        const glyphIndexPosition =
          idRangeOffsetPosition + idRangeOffset + (codePoint - startCode) * 2;
        const glyphInTheArray = subtable.getUint16(glyphIndexPosition);
        glyph = glyphInTheArray === 0 ? 0 : (glyphInTheArray + idDelta) & 0xffff;
      }
      if (glyph !== 0) {
        codePoints.add(codePoint);
      }
    }
  }
}

/** Every code point the WOFF2 font in `fileBytes` maps to a real glyph. */
export function readCodePointsOfWoff2Font(fileBytes: Uint8Array): Set<number> {
  const cmap = readCmapTable(fileBytes);
  const subtableCount = cmap.getUint16(2);
  const subtableOffsets: { format12?: number; format4?: number } = {};
  for (let recordNumber = 0; recordNumber < subtableCount; recordNumber += 1) {
    const recordStart = 4 + recordNumber * 8;
    const platformId = cmap.getUint16(recordStart);
    const encodingId = cmap.getUint16(recordStart + 2);
    const offset = cmap.getUint32(recordStart + 4);
    const format = cmap.getUint16(offset);
    const isWindowsUnicode = platformId === 3 && (encodingId === 1 || encodingId === 10);
    const isUnicodePlatform = platformId === 0;
    if (!isWindowsUnicode && !isUnicodePlatform) {
      continue;
    }
    if (format === 12) {
      subtableOffsets.format12 = offset;
    }
    if (format === 4) {
      subtableOffsets.format4 = offset;
    }
  }
  const codePoints = new Set<number>();
  if (subtableOffsets.format12 !== undefined) {
    const subtable = new DataView(cmap.buffer, cmap.byteOffset + subtableOffsets.format12);
    readFormat12(subtable, codePoints);
    return codePoints;
  }
  if (subtableOffsets.format4 !== undefined) {
    const subtable = new DataView(cmap.buffer, cmap.byteOffset + subtableOffsets.format4);
    readFormat4(subtable, codePoints);
    return codePoints;
  }
  throw new Error('the font has no Unicode cmap subtable (format 12 or 4)');
}

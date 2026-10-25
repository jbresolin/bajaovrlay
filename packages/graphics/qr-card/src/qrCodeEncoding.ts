/**
 * Turns the address into the QR code's squares, in the graphic itself and with nothing from
 * the network (architecture rule 3): qrcode-generator (MIT, no dependencies, pinned in
 * package.json and bundled into qr-card.js by Vite), at error-correction level M, byte mode.
 * This file is the only one that imports the encoder, so swapping it touches one file.
 *
 * How long an address may be is decided here, from the box the code is drawn in: the code
 * grows with the address (a "version" adds 4 modules a side), and each module must stay at
 * least `minimumCellSizePx` wide inside the 176 px `--qr-size` box, so a phone pointed at a
 * 720p stream on a TV still tells the squares apart. qrCodeEncoding.test.ts derives the
 * longest address from the encoder's own capacity and the manifest's `maxLength` must equal it.
 */
import qrcode from 'qrcode-generator';

/** Level M: about 15% of the code may be lost (a glare, a logo-shaped smudge) and it still scans. */
export const qrErrorCorrectionLevel = 'M';

/**
 * The smallest a module may be drawn, in px at 1080p. Three would let a version 9 code in
 * (180 characters), but at 720p that is 2 px a module, which phone cameras read badly off a
 * screen; four keeps every module at least 2.7 px on a 720p stream.
 */
export const minimumCellSizePx = 4;

/**
 * The light margin drawn inside the box around the code, in modules: the design's one
 * module (qr-card.html). The card's own light padding and the box's leftover pixels add to
 * it, so the light around the squares is wider than this (qrCodeLayout.ts measures it).
 */
export const quietZoneModules = 1;

/**
 * The largest QR version whose code still fits the box with every module at least
 * `minimumCellSizePx` wide, counting the quiet zone. A version v code is 17 + 4v modules a
 * side. Answers 0 when not even version 1 fits (a box under 92 px).
 */
export function findLargestVersionWithReadableCells(boxSizePx: number): number {
  let largestVersion = 0;
  for (let version = 1; version <= 40; version += 1) {
    const modulesWithQuietZone = countModulesOfVersion(version) + 2 * quietZoneModules;
    const cellSizePx = Math.floor(boxSizePx / modulesWithQuietZone);
    if (cellSizePx >= minimumCellSizePx) {
      largestVersion = version;
    }
  }
  return largestVersion;
}

/** How many modules a side a code of this version has: 21 for version 1, 41 for version 6. */
export function countModulesOfVersion(version: number): number {
  return 17 + 4 * version;
}

/**
 * Whether a text of this length fits a code of this version at level M in byte mode,
 * asked of the encoder itself (it throws "code length overflow" when it does not fit), so
 * the limit is the library's real capacity and never a table copied by hand.
 */
export function doesTextFitVersion(text: string, version: number): boolean {
  try {
    const code = qrcode(version as Parameters<typeof qrcode>[0], qrErrorCorrectionLevel);
    code.addData(text, 'Byte');
    code.make();
    return true;
  } catch {
    return false;
  }
}

/**
 * The squares of the code for this address, row by row, `true` for a dark module; the
 * smallest version that holds it. The caller has already checked the address (plain ASCII,
 * at most the longest length), so it always fits: the encoder's own byte conversion keeps
 * the low 8 bits of each character, which is exact for ASCII and wrong for anything else.
 */
export function encodeAddressAsQrModules(address: string): boolean[][] {
  const code = qrcode(0, qrErrorCorrectionLevel);
  code.addData(address, 'Byte');
  code.make();
  const moduleCount = code.getModuleCount();
  const rows: boolean[][] = [];
  for (let row = 0; row < moduleCount; row += 1) {
    const modulesOfTheRow: boolean[] = [];
    for (let column = 0; column < moduleCount; column += 1) {
      modulesOfTheRow.push(code.isDark(row, column));
    }
    rows.push(modulesOfTheRow);
  }
  return rows;
}

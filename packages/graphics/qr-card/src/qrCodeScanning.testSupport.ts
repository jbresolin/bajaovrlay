/**
 * Test support for the scan tests: turns a code's squares into the pixels a camera would
 * see (black squares on white, a few px a module, a wide white margin) and decodes them with
 * jsQR, a pure-JS QR reader that is a devDependency of this package only, never bundled. The
 * squares can come from the encoder directly or be read back from the SVG path the card draws.
 */
import jsQR from 'jsqr';

/** The px a module is drawn at for the reader; the card's own size at the longest address. */
const cellSizeForScanningPx = 4;

/** The white margin around the code, in modules: the four the QR standard asks for. */
const marginForScanningModules = 4;

/**
 * Draws the squares as an RGBA picture, black on white, and asks jsQR to read it. Answers the
 * text the code holds, or undefined when jsQR finds no code at all.
 */
export function scanQrModules(modules: boolean[][]): string | undefined {
  const moduleCount = modules.length;
  const sideInModules = moduleCount + 2 * marginForScanningModules;
  const sidePx = sideInModules * cellSizeForScanningPx;
  const pixels = new Uint8ClampedArray(sidePx * sidePx * 4).fill(255);
  for (let y = 0; y < sidePx; y += 1) {
    for (let x = 0; x < sidePx; x += 1) {
      const row = Math.floor(y / cellSizeForScanningPx) - marginForScanningModules;
      const column = Math.floor(x / cellSizeForScanningPx) - marginForScanningModules;
      const isDark = modules[row]?.[column] ?? false;
      if (isDark) {
        const pixelStart = (y * sidePx + x) * 4;
        pixels[pixelStart] = 0;
        pixels[pixelStart + 1] = 0;
        pixels[pixelStart + 2] = 0;
      }
    }
  }
  const code = jsQR(pixels, sidePx, sidePx);
  return code?.data;
}

/**
 * Reads the squares back from the path the card draws (`M<column> <row>h1v1h-1z` per dark
 * module), so a test scans exactly what is on the card, not what the encoder said.
 */
export function readQrModulesFromPathData(pathData: string, moduleCount: number): boolean[][] {
  const modules: boolean[][] = [];
  for (let row = 0; row < moduleCount; row += 1) {
    modules.push(new Array<boolean>(moduleCount).fill(false));
  }
  for (const square of pathData.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    const column = Number(square[1]);
    const row = Number(square[2]);
    const modulesOfTheRow = modules[row];
    if (modulesOfTheRow !== undefined) {
      modulesOfTheRow[column] = true;
    }
  }
  return modules;
}

// @vitest-environment node
/**
 * The QR code's squares and how long an address may be (packages/graphics/qr-card)
 *
 * What this module is for:
 *   qrCodeEncoding.ts turns the address into the code's squares with qrcode-generator at
 *   error-correction level M, in the graphic, with nothing from the network. It also says
 *   how big a code the card can draw: every module at least 4 px inside the theme's 176 px
 *   `--qr-size` box. That decides the longest address, which the manifest's `maxLength`
 *   gives the item editor so it refuses a longer one while the operator types.
 *
 * What these tests prove:
 *   - The largest version that fits the box, read from packages/theme/ardosia/tokens.css,
 *     is version 6 (41 modules a side, 4 px a module), and version 7 would need 3 px.
 *   - The longest address is the encoder's own capacity at version 6, level M: an address
 *     of exactly that length fits, one character more does not. The model's
 *     `longestAddressLength` and the manifest's `maxLength` are that number (106).
 *   - The squares scan back to the address exactly as typed (jsQR), for a short address,
 *     one with capitals and a query, and one of the longest length; the longest gives a
 *     version 6 code and a short one a smaller code.
 *
 * What these tests deliberately do not cover:
 *   - Where the squares go in the box and the light around them; qrCodeLayout.test.ts.
 *   - The code as drawn on the card, scanned; qrCardView.test.ts reads the card's own path
 *     and e2e/qrCardLifecycle.e2e.ts scans the pixels Chromium draws.
 *   - The page: this file runs in plain Node (the pragma on line 1); it reads files.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import qrCardManifest from '../qr-card.ograf.json';
import { buildLongestSampleAddress } from './previewData.js';
import { longestAddressLength } from './qrCardModel.js';
import {
  countModulesOfVersion,
  doesTextFitVersion,
  encodeAddressAsQrModules,
  findLargestVersionWithReadableCells,
  minimumCellSizePx,
} from './qrCodeEncoding.js';
import { scanQrModules } from './qrCodeScanning.testSupport.js';

/**
 * Reads a size token (`--qr-size: 176px;`) from the theme's tokens.css in px, found through
 * the theme package's own exports. Throws when the token is not there: a limit derived from
 * a missing token would pass for the wrong reason.
 */
function readSizeTokenInPixels(tokenName: string): number {
  const resolveLikeNode = createRequire(import.meta.url);
  const tokensCssText = readFileSync(
    resolveLikeNode.resolve('@bajaovrlay/theme/ardosia/tokens.css'),
    'utf8',
  );
  const tokenDeclaration = new RegExp(`${tokenName}:\\s*(\\d+)px;`).exec(tokensCssText);
  if (tokenDeclaration === null) {
    throw new Error(`${tokenName} is not declared in packages/theme/ardosia/tokens.css`);
  }
  return Number(tokenDeclaration[1]);
}

/** Finds the encoder's capacity for one version: the longest address of real characters that fits. */
function findLongestAddressThatFitsVersion(version: number): number {
  const addressCharacters = buildLongestSampleAddress().repeat(4);
  let longestLength = 0;
  while (doesTextFitVersion(addressCharacters.slice(0, longestLength + 1), version)) {
    longestLength += 1;
  }
  return longestLength;
}

describe('the largest code the card draws', () => {
  it('is version 6 in the theme’s --qr-size box, every module at least 4 px', () => {
    // Arrange: the code box as the theme sets it (176 px).
    const boxSizePx = readSizeTokenInPixels('--qr-size');

    // Act: find the largest version whose modules stay readable, and the cell of the next.
    const largestVersion = findLargestVersionWithReadableCells(boxSizePx);
    const cellOfTheNextVersionPx = Math.floor(
      boxSizePx / (countModulesOfVersion(largestVersion + 1) + 2),
    );

    // Assert: version 6 (41 modules and a quiet zone of 1 at each side, 4 px each), and
    // version 7 would fall under the minimum.
    expect(boxSizePx, 'the theme’s code box must be the design’s 176 px').toBe(176);
    expect(largestVersion, 'version 6 must be the largest code that keeps 4 px modules').toBe(6);
    expect(
      cellOfTheNextVersionPx,
      'version 7 must need modules under the minimum, or the limit could be higher',
    ).toBeLessThan(minimumCellSizePx);
  });
});

describe('the longest address', () => {
  it('is what the encoder fits in that version at level M, and the model and manifest say so', () => {
    // Arrange: the largest version the box allows.
    const largestVersion = findLargestVersionWithReadableCells(readSizeTokenInPixels('--qr-size'));

    // Act: ask the encoder how many address characters that version holds.
    const encoderCapacity = findLongestAddressThatFitsVersion(largestVersion);

    // Assert: 106 characters, and both the model's limit and the item editor's maxLength
    // are exactly that number.
    expect(encoderCapacity, 'a version 6 code at level M must hold 106 characters').toBe(106);
    expect(longestAddressLength, 'the model’s limit must be the encoder’s capacity').toBe(
      encoderCapacity,
    );
    expect(
      qrCardManifest.schema.properties.address.maxLength,
      'the manifest’s maxLength must be the encoder’s capacity, so the editor refuses past it',
    ).toBe(encoderCapacity);
  });

  it('fits at exactly the longest length and not with one character more', () => {
    // Arrange: an address of exactly the longest length, and the same with one more character.
    const longestAddress = buildLongestSampleAddress();
    const oneCharacterTooLong = `${longestAddress}x`;

    // Act: ask the encoder whether each fits a version 6 code.
    const doesLongestFit = doesTextFitVersion(longestAddress, 6);
    const doesTooLongFit = doesTextFitVersion(oneCharacterTooLong, 6);

    // Assert: the limit is exact on both sides.
    expect(longestAddress.length, 'the sample must be exactly the longest length').toBe(106);
    expect(doesLongestFit, 'an address at the limit must fit the largest code').toBe(true);
    expect(doesTooLongFit, 'one character past the limit must not fit').toBe(false);
  });
});

const scanScenarios = [
  // The design's card: a bare host, the everyday case.
  { name: 'a short address', address: 'resultados.bajasaebrasil.net', expectedModules: 29 },
  // Capitals and a query: the code must keep the case and every sign as typed, even though
  // the card writes the address in caps.
  {
    name: 'an address with capitals and a query',
    address: 'https://bajasaebrasil.net/Ao-Vivo?prova=enduro&ano=2026',
    expectedModules: 33,
  },
  // The limit: the largest code the card draws.
  {
    name: 'an address of the longest length',
    address: buildLongestSampleAddress(),
    expectedModules: 41,
  },
];

describe('the squares scan back to the address', () => {
  it.each(scanScenarios)('$name', ({ address, expectedModules }) => {
    // Arrange: nothing beyond the address of the row.

    // Act: make the squares and read them as a camera would.
    const modules = encodeAddressAsQrModules(address);
    const scannedText = scanQrModules(modules);

    // Assert: the code is the expected size and holds exactly the address.
    expect(modules.length, 'the code must be the smallest version that holds the address').toBe(
      expectedModules,
    );
    expect(scannedText, 'the code must scan back to the address exactly as typed').toBe(address);
  });
});

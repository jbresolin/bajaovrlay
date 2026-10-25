// Test support for the browser tests that scan a QR code as Chromium drew it: this
// package's lifecycle test, and the control page's walk on the real program output
// (apps/control/e2e/podiumBattleQrWalk.e2e.ts). Kept here, beside jsqr (a devDependency of
// this package only), so the one way to scan a code on screen is written once.
import type { Locator, Page } from '@playwright/test';
import jsQR from 'jsqr';

/**
 * Takes a picture of what `pictureOf` shows (the card: the code and its light surround) and
 * reads it with jsQR in Node, as a phone would. The PNG is turned back into pixels by the
 * page's own canvas, the one decoder at hand, and the pixels come back here. Answers the
 * text the code holds, or undefined when no code is found.
 */
export async function scanQrCodeOnScreen(
  page: Page,
  pictureOf: Locator,
): Promise<string | undefined> {
  const pictureOfTheCard = await pictureOf.screenshot();
  const picture = await page.evaluate(async (pictureAsBase64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${pictureAsBase64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context?.drawImage(image, 0, 0);
    const pixels = context?.getImageData(0, 0, canvas.width, canvas.height).data ?? [];
    return { width: canvas.width, height: canvas.height, pixels: [...pixels] };
  }, pictureOfTheCard.toString('base64'));
  const code = jsQR(Uint8ClampedArray.from(picture.pixels), picture.width, picture.height);
  return code?.data;
}

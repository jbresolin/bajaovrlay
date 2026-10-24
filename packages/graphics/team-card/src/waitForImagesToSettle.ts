/**
 * The wait for the card's images before it is ready to play. Load waits here, so a card
 * played straight after load rises with its photo and logo already drawn (motion.md: they
 * come with the card, never after) instead of popping in a moment later on air.
 *
 * What could go wrong, and why the wait cannot block play: an image settles when it has
 * loaded or failed, and a broken address fails at once, so a broken image costs nothing.
 * A request that never answers (a stalled server) would hold load forever, so the wait
 * also ends after `longestWaitForImagesMs`; the card then plays without that image, which
 * appears when (if) it arrives. This is a guard against a hang, not a visual duration,
 * which is why it is a constant here and not a theme token.
 */

/** How long load waits at most for the card's images, in milliseconds. */
export const longestWaitForImagesMs = 2000;

/** Resolves when the image has loaded or failed, whichever comes first; at once if already done. */
function waitForOneImageToSettle(image: HTMLImageElement): Promise<void> {
  if (image.complete) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener('error', () => resolve(), { once: true });
  });
}

/**
 * Resolves when every `<img>` under `root` has loaded or failed, or after
 * `longestWaitMs`, whichever comes first. Never rejects.
 */
export async function waitForImagesToSettle(
  root: ParentNode,
  longestWaitMs: number = longestWaitForImagesMs,
): Promise<void> {
  const images = [...root.querySelectorAll('img')];
  if (images.length === 0) {
    return;
  }
  let stopWaiting: () => void = () => undefined;
  const longestWaitEnds = new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, longestWaitMs);
    stopWaiting = () => {
      clearTimeout(timer);
      resolve();
    };
  });
  const everyImageSettled = Promise.all(images.map(waitForOneImageToSettle));
  await Promise.race([everyImageSettled, longestWaitEnds]);
  // The timer is cleared once the images are in, so no stray timeout outlives the load.
  stopWaiting();
}

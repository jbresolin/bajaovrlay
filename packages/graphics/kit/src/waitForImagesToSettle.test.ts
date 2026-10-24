/**
 * The wait for a graphic's images (packages/graphics/kit)
 *
 * What this module is for:
 *   Before the team card or the sponsor bug is ready to play, load waits for its images
 *   (a photo, a team's or a sponsor's logo), so the card rises with them already drawn. A broken image or a server that never answers must
 *   never keep the card off air, so the wait ends on load, on failure, or after a
 *   longest wait.
 *
 * What these tests prove:
 *   - With no image there is nothing to wait for.
 *   - An image already loaded (or already failed) does not hold the wait.
 *   - The wait ends when the last image loads, and when an image fails: a broken logo
 *     never blocks.
 *   - An image that never answers holds the wait for `longestWaitForImagesMs` (2 s) and
 *     no longer.
 *
 * What these tests deliberately do not cover:
 *   - Real image files; jsdom loads nothing, so the tests fire the image's own load and
 *     error events by hand. The team card's and the bug's screenshot tests load real files.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { longestWaitForImagesMs, waitForImagesToSettle } from './waitForImagesToSettle.js';

/** Builds a card stand-in holding a car photo and a team logo that have not loaded yet. */
function createCardWithPhotoAndLogoStillLoading() {
  const card = document.createElement('section');
  const photo = document.createElement('img');
  const logo = document.createElement('img');
  Object.defineProperty(photo, 'complete', { value: false });
  Object.defineProperty(logo, 'complete', { value: false });
  photo.src = '/media/0b6f3c2a-photo-car-7';
  logo.src = '/media/5d1e9a40-logo-reptiles';
  card.append(photo, logo);
  return { card, photo, logo };
}

/** Notes whether a promise has settled yet, without waiting for it. */
function watchSettling(promise: Promise<void>) {
  const watch = { hasSettled: false };
  void promise.then(() => {
    watch.hasSettled = true;
  });
  return watch;
}

describe('waitForImagesToSettle', () => {
  it('ends at once when the card has no image', async () => {
    // Arrange: a card without photo or logo.
    const card = document.createElement('section');

    // Act: wait for its images.
    const watch = watchSettling(waitForImagesToSettle(card));
    await Promise.resolve();

    // Assert: there was nothing to wait for.
    expect(watch.hasSettled, 'a card without images must not wait').toBe(true);
  });

  it('ends at once when the images are already complete', async () => {
    // Arrange: a card whose logo is already in the browser's cache.
    const card = document.createElement('section');
    const logo = document.createElement('img');
    Object.defineProperty(logo, 'complete', { value: true });
    card.append(logo);

    // Act: wait for its images.
    const watch = watchSettling(waitForImagesToSettle(card));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert: an image already there does not hold the wait.
    expect(watch.hasSettled, 'a complete image must not hold the wait').toBe(true);
  });

  it('ends when the last image has loaded, not before', async () => {
    // Arrange: a card with its photo and logo on their way.
    const { card, photo, logo } = createCardWithPhotoAndLogoStillLoading();
    const watch = watchSettling(waitForImagesToSettle(card));

    // Act: the photo arrives, then (after a look) the logo.
    photo.dispatchEvent(new Event('load'));
    await Promise.resolve();
    const hadSettledWithThePhotoAlone = watch.hasSettled;
    logo.dispatchEvent(new Event('load'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert: still waiting with one image out; done once both are in.
    expect(hadSettledWithThePhotoAlone, 'the wait must hold until the logo is in too').toBe(false);
    expect(watch.hasSettled, 'the wait must end once both images are in').toBe(true);
  });

  it('ends when an image fails, so a broken logo never blocks the card', async () => {
    // Arrange: a card whose photo loads and whose logo address is broken.
    const { card, photo, logo } = createCardWithPhotoAndLogoStillLoading();
    const watch = watchSettling(waitForImagesToSettle(card));

    // Act: the photo loads and the logo fails.
    photo.dispatchEvent(new Event('load'));
    logo.dispatchEvent(new Event('error'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert: the wait is over; a failure counts as settled.
    expect(watch.hasSettled, 'a failed image must end the wait like a loaded one').toBe(true);
  });

  it('gives up after the longest wait when an image never answers', async () => {
    // Arrange: fake time, and a card whose images never load or fail (a stalled server).
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const { card } = createCardWithPhotoAndLogoStillLoading();
    const watch = watchSettling(waitForImagesToSettle(card));

    // Act: let time run to just before the longest wait, then to it.
    await vi.advanceTimersByTimeAsync(longestWaitForImagesMs - 1);
    const hadSettledJustBefore = watch.hasSettled;
    await vi.advanceTimersByTimeAsync(1);

    // Assert: it waited the whole 2 s, and not a moment longer.
    expect(longestWaitForImagesMs, 'the longest wait must be 2 s').toBe(2000);
    expect(hadSettledJustBefore, 'the wait must hold until the longest wait is up').toBe(false);
    expect(watch.hasSettled, 'the wait must end when the longest wait is up').toBe(true);
  });
});

/**
 * The image graphic's files: the image on screen (its file arrived) and at most one new file
 * on its way, fetched hidden so the image on screen stays up until the new one has arrived
 * (a slow or broken file never blanks what is on air). image.ts owns one of these and
 * redraws when it says something changed; imageView.ts draws `listImagesToDraw()`.
 *
 * Each fetch gets its own key, and Lit keys each `<img>` by it: a new key is a new element,
 * so Chromium asks for a file again even at an address that failed before, and the element
 * that fetched a file is the one shown once it arrives, never a second one loading it again.
 *
 * Deliberate: a copy of logo-bug's logoImageFetches.ts with its names changed, not a kit
 * part shared by both, so this PR leaves the logo bug untouched. Moving it into
 * graphics-kit, for both graphics, is BAJAOVRLAY-86.
 */
import { longestWaitForImagesMs } from '@bajaovrlay/graphics-kit/waitForImagesToSettle';

import type { ImageFileFetch, ImageFileToDraw } from './imageView.js';

/** The image on screen and the file on its way, and the wait of the call that asked for it. */
export class ImageFileFetches {
  private shownImage: ImageFileFetch | undefined = undefined;
  private imageOnItsWay: ImageFileFetch | undefined = undefined;
  // True once the file the data asks for has failed, until the next fetch of it.
  private hasTheWantedImageFailedSoFar = false;
  private fetchCount = 0;
  // Ends the wait of the call that started the fetch on its way; see waitForTheImageOnItsWay.
  private endTheWait: (() => void) | undefined = undefined;

  /** True when the file the data asks for has failed and has not been fetched again since. */
  hasTheWantedImageFailed(): boolean {
    return this.hasTheWantedImageFailedSoFar;
  }

  /** True when an image is on screen, an older one if the wanted file failed. */
  isAnImageOnScreen(): boolean {
    return this.shownImage !== undefined;
  }

  /** The image on screen, then the file on its way; what the view draws. */
  listImagesToDraw(): ImageFileToDraw[] {
    const imagesToDraw: ImageFileToDraw[] = [];
    if (this.shownImage !== undefined) {
      imagesToDraw.push({ ...this.shownImage, state: 'loaded' });
    }
    if (this.imageOnItsWay !== undefined) {
      imagesToDraw.push({ ...this.imageOnItsWay, state: 'waiting' });
    }
    return imagesToDraw;
  }

  /**
   * Starts a fresh fetch of the file at `url`, to be drawn at the next redraw; the promise
   * resolves when it arrives or fails. The address already on screen needs no fetch:
   * whatever was on its way is dropped, and there is nothing to wait for (undefined).
   */
  startFetching(url: string): Promise<void> | undefined {
    // A wait still running for an older fetch ends now, so its call does not hang 2 s.
    this.endAnyWait();
    this.hasTheWantedImageFailedSoFar = false;
    if (this.shownImage?.url === url) {
      this.imageOnItsWay = undefined;
      return undefined;
    }
    this.fetchCount += 1;
    this.imageOnItsWay = { fetchKey: `fetch-${String(this.fetchCount)}`, url };
    return new Promise((resolve) => {
      this.endTheWait = () => {
        this.endTheWait = undefined;
        resolve();
      };
    });
  }

  /**
   * The fetch with this key arrived: it becomes the image on screen. False (nothing to
   * redraw) for an image that is no longer the one on its way: a newer fetch replaced it.
   */
  markArrived(fetchKey: string): boolean {
    if (this.imageOnItsWay?.fetchKey !== fetchKey) {
      return false;
    }
    this.shownImage = this.imageOnItsWay;
    this.imageOnItsWay = undefined;
    this.endAnyWait();
    return true;
  }

  /**
   * The fetch with this key failed: it is dropped, and the image on screen, if any, stays.
   * False (nothing to redraw) for an image that is no longer the one on its way.
   */
  markFailed(fetchKey: string): boolean {
    if (this.imageOnItsWay?.fetchKey !== fetchKey) {
      return false;
    }
    this.imageOnItsWay = undefined;
    this.hasTheWantedImageFailedSoFar = true;
    this.endAnyWait();
    return true;
  }

  /**
   * Waits for a fetch started by startFetching to arrive or fail, at most the kit's 2 s: a
   * request that never answers must not hold a call forever. Only that one image is waited
   * for, never the image already on screen.
   */
  async waitForTheImageOnItsWay(imageSettles: Promise<void> | undefined): Promise<void> {
    if (imageSettles === undefined) {
      return;
    }
    let stopTheTimer: () => void = () => undefined;
    const longestWaitEnds = new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, longestWaitForImagesMs);
      stopTheTimer = () => clearTimeout(timer);
    });
    await Promise.race([imageSettles, longestWaitEnds]);
    stopTheTimer();
  }

  /** Ends the wait of the call that started the fetch on its way, if one is waiting. */
  endAnyWait(): void {
    this.endTheWait?.();
  }
}

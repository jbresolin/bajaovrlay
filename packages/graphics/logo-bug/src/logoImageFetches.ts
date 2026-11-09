/**
 * The logo bug's images: the logo on screen (its file arrived) and at most one new file
 * on its way, fetched hidden so the logo on screen stays up until the new one has arrived
 * (a slow or broken file never blanks what is on air). logo-bug.ts owns one of these and
 * redraws when it says something changed; logoBugView.ts draws `listImagesToDraw()`.
 *
 * Each fetch gets its own key, and Lit keys each `<img>` by it: a new key is a new element,
 * so Chromium asks for a file again even at an address that failed before, and the element
 * that fetched a file is the one shown once it arrives, never a second one loading it again.
 */
import { longestWaitForImagesMs } from '@bajaovrlay/graphics-kit/waitForImagesToSettle';

import type { LogoImageFetch, LogoImageToDraw } from './logoBugView.js';

/** The logo on screen and the file on its way, and the wait of the call that asked for it. */
export class LogoImageFetches {
  private shownImage: LogoImageFetch | undefined = undefined;
  private imageOnItsWay: LogoImageFetch | undefined = undefined;
  // True once the file the data asks for has failed, until the next fetch of it.
  private hasTheWantedImageFailedSoFar = false;
  private fetchCount = 0;
  // Ends the wait of the call that started the fetch on its way; see waitForTheImageOnItsWay.
  private endTheWait: (() => void) | undefined = undefined;

  /** True when the file the data asks for has failed and has not been fetched again since. */
  hasTheWantedImageFailed(): boolean {
    return this.hasTheWantedImageFailedSoFar;
  }

  /** True when a logo is on screen, an older one if the wanted file failed. */
  isALogoOnScreen(): boolean {
    return this.shownImage !== undefined;
  }

  /** The logo on screen, then the file on its way; what the view draws. */
  listImagesToDraw(): LogoImageToDraw[] {
    const imagesToDraw: LogoImageToDraw[] = [];
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
   * The fetch with this key arrived: it becomes the logo on screen. False (nothing to
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
   * The fetch with this key failed: it is dropped, and the logo on screen, if any, stays.
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
   * for, never the logo already on screen.
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

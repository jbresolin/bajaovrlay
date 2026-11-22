/**
 * Test support for the image graphic's component tests: the element under test, its
 * data, and readers for what it shows. No theme token is placed on the page here, so every
 * timeline lasts 0 ms and a test never waits on real motion. jsdom loads no file: a test
 * settles the picture itself with `letTheFileLoad` or `letTheFileFail`.
 */
import { onTestFinished } from 'vitest';

import ImageGraphic from './image.js';
import type { ImageData } from './imageModel.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-image-under-test', ImageGraphic);

/** Builds an item with only the image chosen: the event's poster, every other field at its default. */
export function createEventPosterData(): ImageData {
  return { imageUrl: '/media/4e2a91c7-cartaz-enduro-piracicaba' };
}

/** An address whose file was deleted from the media store: the browser reports it broken. */
export const deletedImageAddress = '/media/8b3f0d52-cartaz-apagado';

/**
 * Puts a fresh image element on the page, as a renderer does before calling load. When
 * the test ends it is disposed and removed, so nothing leaks into the next test.
 */
export function createImageGraphicOnThePage(): ImageGraphic {
  const image = document.createElement('baja-image-under-test') as ImageGraphic;
  document.body.append(image);
  onTestFinished(async () => {
    await image.dispose();
    image.remove();
  });
  return image;
}

/** Loads the image graphic the way an OBS renderer does: real-time, at 1920x1080. */
export function loadImageGraphicWithData(image: ImageGraphic, data: unknown) {
  return image.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Lets the pending promise callbacks and timers of the page run once. */
export function letThePageCatchUp(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Finds one part of the graphic by its test id inside the shadow root; undefined when absent. */
export function findPartOfImageGraphic(
  image: ImageGraphic,
  testId: string,
): HTMLElement | undefined {
  return image.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? undefined;
}

/** The picture on screen (its file arrived); undefined when nothing is drawn. */
export function findTheShownPicture(image: ImageGraphic): HTMLImageElement | undefined {
  return (
    image.shadowRoot?.querySelector<HTMLImageElement>(
      '[data-testid="image-picture"][data-image-state="loaded"]',
    ) ?? undefined
  );
}

/** The picture whose file is on its way, hidden until it arrives; undefined when none is. */
export function findThePictureOnItsWay(image: ImageGraphic): HTMLImageElement | undefined {
  return (
    image.shadowRoot?.querySelector<HTMLImageElement>(
      '[data-testid="image-picture"][data-image-state="waiting"]',
    ) ?? undefined
  );
}

/** How many picture elements the graphic holds: the shown one and the one on its way. */
export function countPictures(image: ImageGraphic): number {
  return image.shadowRoot?.querySelectorAll('[data-testid="image-picture"]').length ?? 0;
}

/** Fires the load event of the picture on its way, as a browser does once the file has arrived. */
export function letTheFileLoad(image: ImageGraphic): void {
  findThePictureOnItsWay(image)?.dispatchEvent(new Event('load'));
}

/** Fires the error event of the picture on its way, as a browser does for a missing file. */
export function letTheFileFail(image: ImageGraphic): void {
  findThePictureOnItsWay(image)?.dispatchEvent(new Event('error'));
}

/** Loads the image graphic and lets its file load, so the test can go on to play it. */
export async function loadImageGraphicAndItsFile(image: ImageGraphic, data: unknown) {
  const pendingLoad = loadImageGraphicWithData(image, data);
  await letThePageCatchUp();
  letTheFileLoad(image);
  return pendingLoad;
}

/** Loads the image graphic with a file that fails, so the test starts from nothing drawn. */
export async function loadImageGraphicWithAFailedFile(image: ImageGraphic) {
  const pendingLoad = loadImageGraphicWithData(image, { imageUrl: deletedImageAddress });
  await letThePageCatchUp();
  letTheFileFail(image);
  return pendingLoad;
}

/** Reads the box's inline opacity, which GSAP sets: "0" off air, "1" on air. */
export function readBoxOpacity(image: ImageGraphic): string | undefined {
  return findPartOfImageGraphic(image, 'image-box')?.style.opacity;
}

// Test support: watches what each layer of the stage holds at every frame the browser
// draws, so a test can prove what a viewer could and could not have seen during a swap.
// Looking once per animation frame is the point: whatever changes and changes back between
// two frames was never drawn, and whatever is there at a frame was.
import type { Page } from '@playwright/test';

/** One element inside a layer at one frame: whose it is and whether the renderer hid it. */
type ElementAtAFrame = { instanceId: string | null; isHidden: boolean };

/** What the page keeps: for each layer id, what it held each time that changed. */
type PageWithLayerFrames = { __layerFrames?: Record<string, ElementAtAFrame[][]> };

/**
 * Starts the watch. Call it before `page.goto`. From then on, at every animation frame,
 * the page notes what each layer container holds, but only when it differs from what the
 * same layer held at the frame before.
 */
export async function watchWhatEachLayerShows(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const pageWithLayerFrames = window as unknown as PageWithLayerFrames;
    const framesByLayerId: Record<string, ElementAtAFrame[][]> = {};
    pageWithLayerFrames.__layerFrames = framesByLayerId;

    function noteWhatEachLayerHoldsAtThisFrame(): void {
      const containers = document.querySelectorAll<HTMLElement>('[data-layer-id]');
      for (const container of containers) {
        const layerId = container.dataset.layerId ?? '';
        const elementsNow = Array.from(container.children).map((child) => ({
          instanceId: (child as HTMLElement).dataset.instanceId ?? null,
          isHidden: (child as HTMLElement).style.visibility === 'hidden',
        }));
        const framesOfThisLayer = framesByLayerId[layerId] ?? [];
        const elementsAtTheFrameBefore = framesOfThisLayer.at(-1);
        const isUnchanged =
          JSON.stringify(elementsAtTheFrameBefore) === JSON.stringify(elementsNow);
        if (!isUnchanged) {
          framesOfThisLayer.push(elementsNow);
          framesByLayerId[layerId] = framesOfThisLayer;
        }
      }
      requestAnimationFrame(noteWhatEachLayerHoldsAtThisFrame);
    }
    requestAnimationFrame(noteWhatEachLayerHoldsAtThisFrame);
  });
}

/**
 * Reads what one layer showed, as one sentence per change, oldest first: `nothing` for an
 * empty layer, otherwise its elements in page order, such as `UFPR visible` or
 * `UFPR visible + FEI hidden`. `instanceNames` maps each instance id to the name the test
 * gives it.
 */
export async function readWhatLayerShowed(
  page: Page,
  layerId: string,
  instanceNames: Record<string, string>,
): Promise<string[]> {
  const framesOfTheLayer = await page.evaluate((watchedLayerId) => {
    const pageWithLayerFrames = window as unknown as PageWithLayerFrames;
    return pageWithLayerFrames.__layerFrames?.[watchedLayerId] ?? [];
  }, layerId);

  return framesOfTheLayer.map((elementsAtOneFrame) => {
    if (elementsAtOneFrame.length === 0) {
      return 'nothing';
    }
    const descriptions = elementsAtOneFrame.map((element) => {
      const instanceName = instanceNames[element.instanceId ?? ''] ?? 'unknown instance';
      const visibility = element.isHidden ? 'hidden' : 'visible';
      return `${instanceName} ${visibility}`;
    });
    return descriptions.join(' + ');
  });
}

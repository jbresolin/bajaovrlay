// @vitest-environment jsdom
/**
 * One container per layer on the stage (apps/renderer)
 *
 * What this module is for:
 *   The stage is the transparent 1920x1080 area OBS shows. Each layer of the stream
 *   (logo, ticker, clock, lower third, fullscreen) gets one container inside it, stacked
 *   so a higher `zIndex` draws on top. Graphics are later placed inside their layer's
 *   container, so stacking is decided once, here, and never by a graphic.
 *
 * What these tests prove:
 *   - Containers are stacked by `zIndex`, whatever order the slice lists the layers in.
 *   - Each container carries its layer id (`data-layer-id`), covers the whole stage and
 *     can be found again by layer id.
 *   - Showing the same layers again changes nothing on the page.
 *   - When the layers do change, a layer that is still there keeps its container (and so
 *     the graphic inside it); a layer that left loses its container.
 *
 * What these tests deliberately do not cover:
 *   - Real pixels and stacking in Chromium; e2e/lifecycle.e2e.ts runs in a real browser.
 *   - Theme values on the containers; themes arrive in a later task.
 */
import type { Layer } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { createLayerContainers } from './layerContainers.js';

/** Builds one layer of the stream; only the id, name and z-index vary in these tests. */
function createLayer(id: string, name: string, zIndex: number): Layer {
  return { id, name, zIndex, replacePolicy: 'out-then-in', persistent: false };
}

/** Builds an empty stage element, like the `#stage` of the renderer page. */
function createEmptyStage(): HTMLElement {
  const stage = document.createElement('div');
  stage.id = 'stage';
  return stage;
}

/** Lists the layer ids of the stage's containers, from the bottom of the stack to the top. */
function readLayerIdsInStageOrder(stage: HTMLElement): Array<string | undefined> {
  const containers = Array.from(stage.children) as HTMLElement[];
  return containers.map((container) => container.dataset.layerId);
}

describe('createLayerContainers', () => {
  it('stacks the containers by zIndex, whatever order the layers arrive in', () => {
    // Arrange: an empty stage, and three layers listed out of order.
    const stage = createEmptyStage();
    const layerContainers = createLayerContainers(stage);
    const layersOutOfOrder = [
      createLayer('fullscreen', 'Tela cheia', 50),
      createLayer('bug', 'Logo', 10),
      createLayer('clock', 'Relógio', 30),
    ];

    // Act: show the layers.
    layerContainers.showLayers(layersOutOfOrder);

    // Assert: the page order and the CSS z-index both go from the logo up to fullscreen.
    const containers = Array.from(stage.children) as HTMLElement[];
    expect(
      readLayerIdsInStageOrder(stage),
      'the containers must be in z-order, lowest first',
    ).toEqual(['bug', 'clock', 'fullscreen']);
    expect(
      containers.map((container) => container.style.zIndex),
      'each container must carry its layer zIndex as CSS z-index',
    ).toEqual(['10', '30', '50']);
  });

  it('gives each container its layer id and the full size of the stage', () => {
    // Arrange: an empty stage and the clock layer.
    const stage = createEmptyStage();
    const layerContainers = createLayerContainers(stage);

    // Act: show the layer and look its container up by layer id.
    layerContainers.showLayers([createLayer('clock', 'Relógio', 30)]);
    const clockContainer = layerContainers.findContainerOfLayer('clock');

    // Assert: the container is on the stage, names its layer and covers the stage.
    expect(clockContainer?.parentElement, 'the container must be a child of the stage').toBe(stage);
    expect(clockContainer?.dataset.layerId, 'the container must name its layer').toBe('clock');
    expect(
      {
        position: clockContainer?.style.position,
        top: clockContainer?.style.top,
        left: clockContainer?.style.left,
        width: clockContainer?.style.width,
        height: clockContainer?.style.height,
      },
      'the container must be absolutely positioned over the whole stage',
    ).toEqual({ position: 'absolute', top: '0px', left: '0px', width: '100%', height: '100%' });
    expect(
      layerContainers.findContainerOfLayer('placar'),
      'a layer that was never shown must have no container',
    ).toBeUndefined();
  });

  it('changes nothing on the page when the same layers are shown again', () => {
    // Arrange: a stage already showing two layers, with a watcher on every page change.
    const stage = createEmptyStage();
    const layerContainers = createLayerContainers(stage);
    const firstAnswer = layerContainers.showLayers([
      createLayer('bug', 'Logo', 10),
      createLayer('clock', 'Relógio', 30),
    ]);
    const pageChangeWatcher = new MutationObserver(() => undefined);
    pageChangeWatcher.observe(stage, { childList: true, attributes: true, subtree: true });

    // Act: the server sends the very same layers again (every hello carries them).
    const secondAnswer = layerContainers.showLayers([
      createLayer('bug', 'Logo', 10),
      createLayer('clock', 'Relógio', 30),
    ]);
    const pageChanges = pageChangeWatcher.takeRecords();
    pageChangeWatcher.disconnect();

    // Assert: the first call built the containers; the second touched nothing.
    expect(firstAnswer, 'showing layers for the first time must rebuild').toBe('rebuilt');
    expect(secondAnswer, 'showing the same layers again must say nothing changed').toBe(
      'unchanged',
    );
    expect(pageChanges, 'the page must not be touched when the layers did not change').toEqual([]);
  });

  it('keeps the container of a layer that stays, so the graphic inside it survives', () => {
    // Arrange: two layers on the stage, with a clock graphic inside the clock container.
    const stage = createEmptyStage();
    const layerContainers = createLayerContainers(stage);
    layerContainers.showLayers([
      createLayer('bug', 'Logo', 10),
      createLayer('clock', 'Relógio', 30),
    ]);
    const clockContainerBefore = layerContainers.findContainerOfLayer('clock');
    const clockGraphic = document.createElement('baja-graphic-race-clock');
    clockContainerBefore?.append(clockGraphic);

    // Act: the layers change: the logo layer leaves, a ticker joins below the clock, and
    // the clock moves up to z-index 35.
    const answer = layerContainers.showLayers([
      createLayer('clock', 'Relógio', 35),
      createLayer('ticker', 'Rodapé', 20),
    ]);

    // Assert: the clock kept its container and graphic; the stack follows the new layers.
    const clockContainerAfter = layerContainers.findContainerOfLayer('clock');
    expect(answer, 'changed layers must be reported as a rebuild').toBe('rebuilt');
    expect(clockContainerAfter, 'a layer that stays must keep the same container element').toBe(
      clockContainerBefore,
    );
    expect(
      clockGraphic.parentElement,
      'the graphic on a layer that stays must still be in its container',
    ).toBe(clockContainerAfter);
    expect(clockContainerAfter?.style.zIndex, 'the container must take the new zIndex').toBe('35');
    expect(
      readLayerIdsInStageOrder(stage),
      'the stage must hold exactly the new layers, in z-order',
    ).toEqual(['ticker', 'clock']);
    expect(
      layerContainers.findContainerOfLayer('bug'),
      'a layer that left must have no container any more',
    ).toBeUndefined();
  });
});

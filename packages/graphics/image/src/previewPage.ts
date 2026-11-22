/**
 * Wires preview.html: sets the stage from `?stage=`, registers the graphic as a renderer
 * would, loads it with the data from the address (previewData.ts), plays it in, and adds
 * buttons for play, stop and each of the nine positions. `data-preview-state` on <body>
 * tells tests and people what happened last: loading, busy, onAir, offAir or error (a
 * failed file ends in error, with the graphic's 422 on the answer line).
 *
 * The theme's tokens and font are imported here from the theme package, so the preview
 * looks like the air without a server; on air the renderer page links the same files.
 */
import '@bajaovrlay/theme/ardosia/tokens.css';
import '@bajaovrlay/theme/fonts/fonts.css';

import { setUpPreviewControls } from '@bajaovrlay/graphics-kit/previewControls';
import { choosePreviewStage } from '@bajaovrlay/graphics-kit/previewStage';

import ImageGraphic from './image.js';
import { imageAnchors } from './imageBoxPosition.js';
import { choosePreviewData } from './previewData.js';
import { ptBR } from './ptBR.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

/** Adds one button per position; each moves the image there with an update, on air or off. */
function addPositionButtons(image: ImageGraphic): void {
  for (const anchor of imageAnchors) {
    addPreviewButton(ptBR.preview.positionButton(ptBR.preview.anchorNames[anchor]), () => {
      const stateAfterUpdate = readPreviewState() === 'offAir' ? 'offAir' : 'onAir';
      void runActionAndShowAnswer(
        'updateAction',
        () => image.updateAction({ data: { position: anchor } }),
        stateAfterUpdate,
      );
    });
  }
}

async function startPreview(): Promise<void> {
  document.body.dataset.stage = choosePreviewStage(location.search);
  customElements.define('baja-image', ImageGraphic);
  const image = document.createElement('baja-image') as ImageGraphic;
  previewStage.append(image);

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => image.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => image.stopAction({}), 'offAir');
  });
  addPositionButtons(image);

  const dataChoice = choosePreviewData(location.search);
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }

  await runActionAndShowAnswer(
    'load',
    () =>
      image.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => image.playAction({}), 'onAir');
  }
}

void startPreview();

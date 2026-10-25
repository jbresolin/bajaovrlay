/**
 * Wires preview.html: sets the stage from `?stage=`, registers the graphic as a renderer
 * would, loads it with the data from the address (previewData.ts), plays it in, and adds
 * buttons for play, stop and the demo's "Atualizar" (the next page now, the hold started
 * again). `data-preview-state` on <body> tells tests and people what happened last.
 *
 * The theme's tokens and font are imported here from the theme package, so the preview
 * looks like the air without a server.
 */
import '@bajaovrlay/theme/ardosia/tokens.css';
import '@bajaovrlay/theme/fonts/fonts.css';

import { setUpPreviewControls } from '@bajaovrlay/graphics-kit/previewControls';
import { choosePreviewStage } from '@bajaovrlay/graphics-kit/previewStage';

import { choosePreviewData } from './previewData.js';
import { ptBR } from './ptBR.js';
import SponsorRollGraphic from './sponsor-roll.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

async function startPreview(): Promise<void> {
  document.body.dataset.stage = choosePreviewStage(location.search);
  customElements.define('baja-sponsor-roll', SponsorRollGraphic);
  const roll = document.createElement('baja-sponsor-roll') as SponsorRollGraphic;
  previewStage.append(roll);

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => roll.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => roll.stopAction({}), 'offAir');
  });
  addPreviewButton(ptBR.preview.nextPageButton, () => {
    void roll.turnToTheNextPageNow();
  });

  const dataChoice = choosePreviewData(location.search);
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }
  await runActionAndShowAnswer(
    'load',
    () =>
      roll.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => roll.playAction({}), 'onAir');
  }
}

void startPreview();

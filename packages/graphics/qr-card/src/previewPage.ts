/**
 * Wires preview.html: sets the stage from `?stage=`, registers the graphic as a renderer
 * would, loads it with the data from the address (previewData.ts), plays it in, and adds
 * buttons for play, stop, and a short or the longest address. `data-preview-state` on <body>
 * tells tests and people what happened last: loading, busy, onAir, offAir or error.
 *
 * The theme's tokens and font are imported here from the theme package, so the preview
 * looks like the air without a server; on air the renderer page links the same two files
 * from /theme/ (packages/theme/README.md).
 */
import '@bajaovrlay/theme/ardosia/tokens.css';
import '@bajaovrlay/theme/fonts/fonts.css';

import { setUpPreviewControls } from '@bajaovrlay/graphics-kit/previewControls';
import { choosePreviewStage } from '@bajaovrlay/graphics-kit/previewStage';

import {
  choosePreviewData,
  createLongestAddressSample,
  createResultsSample,
} from './previewData.js';
import { ptBR } from './ptBR.js';
import QrCardGraphic from './qr-card.js';
import type { QrCardData } from './qrCardModel.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

/** Sends a sample as one update, keeping the card on air or off as it is. */
function sendSample(qrCard: QrCardGraphic, sample: QrCardData): void {
  const stateAfterUpdate = readPreviewState() === 'offAir' ? 'offAir' : 'onAir';
  void runActionAndShowAnswer(
    'updateAction',
    () => qrCard.updateAction({ data: sample }),
    stateAfterUpdate,
  );
}

async function startPreview(): Promise<void> {
  document.body.dataset.stage = choosePreviewStage(location.search);
  customElements.define('baja-qr-card', QrCardGraphic);
  const qrCard = document.createElement('baja-qr-card') as QrCardGraphic;
  previewStage.append(qrCard);

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => qrCard.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => qrCard.stopAction({}), 'offAir');
  });
  addPreviewButton(ptBR.preview.shortAddressButton, () => {
    sendSample(qrCard, createResultsSample());
  });
  addPreviewButton(ptBR.preview.longestAddressButton, () => {
    sendSample(qrCard, createLongestAddressSample());
  });

  const dataChoice = choosePreviewData(location.search);
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }

  await runActionAndShowAnswer(
    'load',
    () =>
      qrCard.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => qrCard.playAction({}), 'onAir');
  }
}

void startPreview();

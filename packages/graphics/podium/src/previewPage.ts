/**
 * Wires preview.html: sets the stage from `?stage=`, registers the graphic as a renderer
 * would, loads it with the data from the address (previewData.ts), plays it in (the head
 * alone, step 0), and adds buttons for play, Próximo (the next step: 3rd, 2nd, 1st, then
 * off air), stop, and the three samples (with logos, without, a tie for first).
 * `data-preview-state` on <body> tells tests and people what happened last: loading, busy,
 * onAir, offAir or error.
 *
 * The theme's tokens and font are imported here from the theme package, so the preview
 * looks like the air without a server; on air the renderer page links the same two files
 * from /theme/ (packages/theme/README.md).
 */
import '@bajaovrlay/theme/ardosia/tokens.css';
import '@bajaovrlay/theme/fonts/fonts.css';

import { setUpPreviewControls } from '@bajaovrlay/graphics-kit/previewControls';
import { choosePreviewStage } from '@bajaovrlay/graphics-kit/previewStage';

import PodiumGraphic from './podium.js';
import { type PodiumData, podiumStepCount } from './podiumModel.js';
import {
  choosePreviewData,
  createEnduroPodium,
  createOverallPodiumWithATieForFirst,
} from './previewData.js';
import { ptBR } from './ptBR.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

/** Sends a sample as one update; a field it leaves out is cleared, as the whole item would be. */
function sendSample(podium: PodiumGraphic, sample: PodiumData): void {
  const update = { data: { eventLine: undefined, ...sample } };
  const stateAfterUpdate = readPreviewState() === 'offAir' ? 'offAir' : 'onAir';
  void runActionAndShowAnswer('updateAction', () => podium.updateAction(update), stateAfterUpdate);
}

async function startPreview(): Promise<void> {
  previewStage.dataset.stage = choosePreviewStage(location.search);
  customElements.define('baja-podium', PodiumGraphic);
  const podium = document.createElement('baja-podium') as PodiumGraphic;
  previewStage.append(podium);

  // The step on air as this page drove it (undefined off air), so Próximo knows when the
  // next press takes the podium off air (past the 1st place, the OGraf step rule).
  let stepOnAir: number | undefined;

  addPreviewButton(ptBR.preview.playButton, () => {
    stepOnAir ??= 0;
    void runActionAndShowAnswer('playAction', () => podium.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.nextButton, () => {
    // Off air, a play would bring the head in, which is the play button's job.
    if (readPreviewState() !== 'onAir' || stepOnAir === undefined) {
      return;
    }
    const stepAfterThePress = stepOnAir + 1;
    const isTheEnd = stepAfterThePress >= podiumStepCount;
    stepOnAir = isTheEnd ? undefined : stepAfterThePress;
    void runActionAndShowAnswer(
      'playAction',
      () => podium.playAction({}),
      isTheEnd ? 'offAir' : 'onAir',
    );
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    stepOnAir = undefined;
    void runActionAndShowAnswer('stopAction', () => podium.stopAction({}), 'offAir');
  });
  addPreviewButton(ptBR.preview.withLogosButton, () =>
    sendSample(podium, createEnduroPodium(true)),
  );
  addPreviewButton(ptBR.preview.withoutLogosButton, () =>
    sendSample(podium, createEnduroPodium(false)),
  );
  addPreviewButton(ptBR.preview.tieButton, () =>
    sendSample(podium, createOverallPodiumWithATieForFirst()),
  );

  const dataChoice = choosePreviewData(location.search);
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }

  await runActionAndShowAnswer(
    'load',
    () =>
      podium.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    stepOnAir = 0;
    await runActionAndShowAnswer('playAction', () => podium.playAction({}), 'onAir');
  }
}

void startPreview();

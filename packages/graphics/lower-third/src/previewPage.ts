/**
 * Wires preview.html: registers the graphic as a renderer would, paints the stage asked
 * for by `?stage=`, loads the graphic with the data from `?data=` (or the team captain
 * sample), plays it in, and adds buttons for play, stop and the three samples.
 * `data-preview-state` on <body> tells tests and people what happened last: loading,
 * busy, onAir, offAir or error.
 *
 * The theme's tokens and font are imported here from the theme package, so the preview
 * looks like the air without a server; on air the renderer page links the same two files
 * from /theme/ (packages/theme/README.md).
 */
import '@bajaovrlay/theme/ardosia/tokens.css';
import '@bajaovrlay/theme/fonts/fonts.css';

import { setUpPreviewControls } from '@bajaovrlay/graphics-kit/previewControls';
import { choosePreviewStage } from '@bajaovrlay/graphics-kit/previewStage';

import LowerThirdGraphic from './lower-third.js';
import type { LowerThirdData } from './lowerThirdModel.js';
import {
  choosePreviewData,
  createNameOnlySample,
  createNarratorSample,
  createTeamCaptainSample,
} from './previewData.js';
import { ptBR } from './ptBR.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

async function startPreview(): Promise<void> {
  // preview.html paints each stage from this attribute; the colours live there.
  previewStage.dataset.stage = choosePreviewStage(location.search);

  customElements.define('baja-lower-third', LowerThirdGraphic);
  const lowerThird = document.createElement('baja-lower-third') as LowerThirdGraphic;
  previewStage.append(lowerThird);

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => lowerThird.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => lowerThird.stopAction({}), 'offAir');
  });

  // A sample button sends every field of its sample, cleared ones as undefined, so the
  // lower third switches to exactly that sample rather than a mix with the last one.
  function addSampleButton(label: string, createSample: () => LowerThirdData): void {
    addPreviewButton(label, () => {
      const sampleUpdate = { data: createSample() };
      void runActionAndShowAnswer(
        'updateAction',
        () => lowerThird.updateAction(sampleUpdate),
        'onAir',
      );
    });
  }
  addSampleButton(ptBR.preview.withRoleAndTeamLineButton, createTeamCaptainSample);
  addSampleButton(ptBR.preview.withRoleButton, createNarratorSample);
  addSampleButton(ptBR.preview.nameOnlyButton, createNameOnlySample);

  const dataChoice = choosePreviewData(location.search);
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }

  await runActionAndShowAnswer(
    'load',
    () =>
      lowerThird.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => lowerThird.playAction({}), 'onAir');
  }
}

void startPreview();

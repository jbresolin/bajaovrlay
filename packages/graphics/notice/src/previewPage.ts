/**
 * Wires preview.html: registers the graphic as a renderer would, loads it with the data
 * from `?data=` (or the fastest lap sample), plays it in, and adds buttons for play, stop
 * and each variant. `data-preview-state` on <body> tells tests and people what happened
 * last: loading, busy, onAir, offAir or error.
 *
 * The theme's tokens and font are imported here from the theme package, so the preview
 * looks like the air without a server; on air the renderer page links the same two files
 * from /theme/ (packages/theme/README.md).
 */
import '@bajaovrlay/theme/ardosia/tokens.css';
import '@bajaovrlay/theme/fonts/fonts.css';

import { setUpPreviewControls } from '@bajaovrlay/graphics-kit/previewControls';

import NoticeGraphic from './notice.js';
import { choosePreviewData, createFastestLapSample, createPenaltySample } from './previewData.js';
import { ptBR } from './ptBR.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

async function startPreview(): Promise<void> {
  customElements.define('baja-notice', NoticeGraphic);
  const notice = document.createElement('baja-notice') as NoticeGraphic;
  previewStage.append(notice);

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => notice.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => notice.stopAction({}), 'offAir');
  });
  // A variant button sends the whole sample of that variant, so the card switches to a
  // complete fastest lap or a complete penalty rather than to half of one.
  addPreviewButton(ptBR.preview.fastestLapButton, () => {
    const fastestLapUpdate = { data: createFastestLapSample() };
    void runActionAndShowAnswer(
      'updateAction',
      () => notice.updateAction(fastestLapUpdate),
      'onAir',
    );
  });
  addPreviewButton(ptBR.preview.penaltyButton, () => {
    const penaltyUpdate = { data: createPenaltySample() };
    void runActionAndShowAnswer('updateAction', () => notice.updateAction(penaltyUpdate), 'onAir');
  });

  const dataChoice = choosePreviewData(location.search);
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }

  await runActionAndShowAnswer(
    'load',
    () =>
      notice.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => notice.playAction({}), 'onAir');
  }
}

void startPreview();

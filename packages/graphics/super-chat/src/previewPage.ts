/**
 * Wires preview.html: registers the graphic as a renderer would, loads it with the data
 * from `?data=` (or the short message sample), plays it in, and adds buttons for play, stop
 * and each sample. `data-preview-state` on <body> tells tests and people what happened
 * last: loading, busy, onAir, offAir or error.
 *
 * The theme's tokens and font are imported here from the theme package, so the preview
 * looks like the air without a server; on air the renderer page links the same two files
 * from /theme/ (packages/theme/README.md).
 */
import '@bajaovrlay/theme/ardosia/tokens.css';
import '@bajaovrlay/theme/fonts/fonts.css';

import { setUpPreviewControls } from '@bajaovrlay/graphics-kit/previewControls';

import {
  choosePreviewData,
  createEmptyMessageSample,
  createShortMessageSample,
} from './previewData.js';
import { ptBR } from './ptBR.js';
import SuperChatGraphic from './super-chat.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

async function startPreview(): Promise<void> {
  customElements.define('baja-super-chat', SuperChatGraphic);
  const superChat = document.createElement('baja-super-chat') as SuperChatGraphic;
  previewStage.append(superChat);

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => superChat.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => superChat.stopAction({}), 'offAir');
  });
  // A sample button sends the whole sample, so the card switches to a complete Super Chat
  // rather than to half of one.
  addPreviewButton(ptBR.preview.shortMessageButton, () => {
    const shortMessageUpdate = { data: createShortMessageSample() };
    void runActionAndShowAnswer(
      'updateAction',
      () => superChat.updateAction(shortMessageUpdate),
      'onAir',
    );
  });
  addPreviewButton(ptBR.preview.emptyMessageButton, () => {
    const emptyMessageUpdate = { data: createEmptyMessageSample() };
    void runActionAndShowAnswer(
      'updateAction',
      () => superChat.updateAction(emptyMessageUpdate),
      'onAir',
    );
  });

  const dataChoice = choosePreviewData(location.search);
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }

  await runActionAndShowAnswer(
    'load',
    () =>
      superChat.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => superChat.playAction({}), 'onAir');
  }
}

void startPreview();

/**
 * Wires preview.html: sets the stage from `?stage=`, registers the graphic as a renderer
 * would, loads it with the data from the address (previewData.ts), plays it in, and adds
 * buttons for play, stop, the next message, the clock block on and off, one or three
 * messages (as "Atualizar no ar" sends them) and each flag. The messages turn by themselves
 * every `--motion-strip-hold`, as on air. `data-preview-state` on <body> tells tests and people
 * what happened last: loading, busy, onAir, offAir or error.
 *
 * The theme's tokens and font are imported here from the theme package, so the preview
 * looks like the air without a server; on air the renderer page links the same two files
 * from /theme/ (packages/theme/README.md).
 */
import '@bajaovrlay/theme/ardosia/tokens.css';
import '@bajaovrlay/theme/fonts/fonts.css';

import { setUpPreviewControls } from '@bajaovrlay/graphics-kit/previewControls';
import { choosePreviewStage } from '@bajaovrlay/graphics-kit/previewStage';
import { flagWordsInPortuguese } from '@bajaovrlay/graphics-kit/ptBRFlagWords';
import { flagStates } from '@bajaovrlay/graphics-kit/raceClockReading';
import { readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';

import MessageTickerGraphic from './message-ticker.js';
import { choosePreviewData, createEnduroAnnouncements } from './previewData.js';
import { ptBR } from './ptBR.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

/** Sends one update, keeping the page state (on air stays on air, off air stays off air). */
function sendUpdate(messageTicker: MessageTickerGraphic, data: Record<string, unknown>): void {
  const stateAfterUpdate = readPreviewState() === 'offAir' ? 'offAir' : 'onAir';
  void runActionAndShowAnswer(
    'updateAction',
    () => messageTicker.updateAction({ data }),
    stateAfterUpdate,
  );
}

/** Adds the buttons beyond play and stop. */
function addMoreButtons(messageTicker: MessageTickerGraphic): void {
  addPreviewButton(ptBR.preview.nextPageButton, () => {
    void messageTicker.turnToTheNextPageNow();
  });
  addPreviewButton(ptBR.preview.clockOnButton, () => {
    sendUpdate(messageTicker, { showClockBlock: true });
  });
  addPreviewButton(ptBR.preview.clockOffButton, () => {
    sendUpdate(messageTicker, { showClockBlock: false });
  });
  addPreviewButton(ptBR.preview.oneMessageButton, () => {
    sendUpdate(messageTicker, { messages: createEnduroAnnouncements().slice(0, 1) });
  });
  addPreviewButton(ptBR.preview.threeMessagesButton, () => {
    sendUpdate(messageTicker, { messages: createEnduroAnnouncements() });
  });
  for (const flagState of flagStates) {
    addPreviewButton(ptBR.preview.flagButton(flagWordsInPortuguese[flagState]), () => {
      sendUpdate(messageTicker, { state: flagState });
    });
  }
}

async function startPreview(): Promise<void> {
  document.body.dataset.stage = choosePreviewStage(location.search);
  customElements.define('baja-message-ticker', MessageTickerGraphic);
  const messageTicker = document.createElement('baja-message-ticker') as MessageTickerGraphic;
  previewStage.append(messageTicker);

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => messageTicker.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => messageTicker.stopAction({}), 'offAir');
  });
  addMoreButtons(messageTicker);

  const dataChoice = choosePreviewData(location.search, readServerAlignedTimeMs());
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }

  await runActionAndShowAnswer(
    'load',
    () =>
      messageTicker.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => messageTicker.playAction({}), 'onAir');
  }
}

void startPreview();

/**
 * Wires preview.html: sets the stage from `?stage=`, registers the graphic as a renderer
 * would, loads it with the data from the address (previewData.ts), plays it in, and adds
 * buttons for play, stop, the next page, the clock block on and off, a swap of the two
 * leaders (a live update) and each flag. The pages turn by themselves every
 * `--motion-strip-hold`, as on air. `data-preview-state` on <body> tells tests and people
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

import LowerStripGraphic from './lower-strip.js';
import { choosePreviewData } from './previewData.js';
import { ptBR } from './ptBR.js';
import { createRealEnduroField } from './realEnduroField.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

/** Sends one update, keeping the page state (on air stays on air, off air stays off air). */
function sendUpdate(lowerStrip: LowerStripGraphic, data: Record<string, unknown>): void {
  const stateAfterUpdate = readPreviewState() === 'offAir' ? 'offAir' : 'onAir';
  void runActionAndShowAnswer(
    'updateAction',
    () => lowerStrip.updateAction({ data }),
    stateAfterUpdate,
  );
}

/** The real field with the first two cars swapped, as the live binding would send it. */
function createFieldWithTheLeadersSwapped() {
  const field = createRealEnduroField();
  const [leader, second, ...rest] = field;
  if (leader === undefined || second === undefined) {
    return field;
  }
  return [{ ...second, position: 1 }, { ...leader, position: 2 }, ...rest];
}

/** Adds the buttons beyond play and stop. */
function addMoreButtons(lowerStrip: LowerStripGraphic): void {
  addPreviewButton(ptBR.preview.nextPageButton, () => {
    void lowerStrip.turnToTheNextPageNow();
  });
  addPreviewButton(ptBR.preview.clockOnButton, () => {
    sendUpdate(lowerStrip, { showClockBlock: true });
  });
  addPreviewButton(ptBR.preview.clockOffButton, () => {
    sendUpdate(lowerStrip, { showClockBlock: false });
  });
  addPreviewButton(ptBR.preview.swapLeadersButton, () => {
    sendUpdate(lowerStrip, { entries: createFieldWithTheLeadersSwapped() });
  });
  for (const flagState of flagStates) {
    addPreviewButton(ptBR.preview.flagButton(flagWordsInPortuguese[flagState]), () => {
      sendUpdate(lowerStrip, { state: flagState });
    });
  }
}

async function startPreview(): Promise<void> {
  document.body.dataset.stage = choosePreviewStage(location.search);
  customElements.define('baja-lower-strip', LowerStripGraphic);
  const lowerStrip = document.createElement('baja-lower-strip') as LowerStripGraphic;
  previewStage.append(lowerStrip);

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => lowerStrip.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => lowerStrip.stopAction({}), 'offAir');
  });
  addMoreButtons(lowerStrip);

  const dataChoice = choosePreviewData(location.search, readServerAlignedTimeMs());
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }

  await runActionAndShowAnswer(
    'load',
    () =>
      lowerStrip.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => lowerStrip.playAction({}), 'onAir');
  }
}

void startPreview();

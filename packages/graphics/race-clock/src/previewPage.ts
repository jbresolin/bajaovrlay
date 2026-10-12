/**
 * Wires preview.html: registers the graphic as a renderer would, loads it with the data
 * from `?data=` (or the running enduro sample), plays it in, and adds buttons for play,
 * stop and each flag state. `data-preview-state` on <body> tells tests and people what
 * happened last: loading, busy, onAir, offAir or error.
 */
import { readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';

import type { OGrafReturnPayload } from './ografGraphicTypes.js';
import { choosePreviewData } from './previewData.js';
import { ptBR } from './ptBR.js';
import RaceClockGraphic from './race-clock.js';
import { flagStates } from './raceClockModel.js';

type PreviewState = 'loading' | 'busy' | 'onAir' | 'offAir' | 'error';

/** Finds an element preview.html is known to have; a missing one is a bug in the page. */
function findPreviewElement(elementId: string): HTMLElement {
  const element = document.getElementById(elementId);
  if (element === null) {
    throw new Error(`preview.html has no #${elementId}; the page and previewPage.ts disagree`);
  }
  return element;
}

const previewStage = findPreviewElement('preview-stage');
const previewControls = findPreviewElement('preview-controls');
const previewLastAnswer = findPreviewElement('preview-last-answer');

function setPreviewState(previewState: PreviewState): void {
  document.body.dataset.previewState = previewState;
}

/**
 * Runs one OGraf action, shows its answer under the buttons and sets the page state:
 * `stateOnSuccess` when the answer is 2xx, "error" otherwise.
 */
async function runActionAndShowAnswer(
  actionName: string,
  runAction: () => Promise<OGrafReturnPayload>,
  stateOnSuccess: PreviewState,
): Promise<void> {
  setPreviewState('busy');
  const answer = await runAction();
  previewLastAnswer.textContent = ptBR.preview.lastAnswer(
    actionName,
    answer.statusCode,
    answer.statusMessage,
  );
  const isSuccess = answer.statusCode >= 200 && answer.statusCode < 300;
  setPreviewState(isSuccess ? stateOnSuccess : 'error');
}

function addPreviewButton(label: string, onPress: () => void): void {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onPress);
  previewControls.insertBefore(button, previewLastAnswer);
}

async function startPreview(): Promise<void> {
  document.title = ptBR.preview.pageTitle;
  previewControls.setAttribute('aria-label', ptBR.preview.controlsLabel);

  customElements.define('baja-race-clock', RaceClockGraphic);
  const raceClock = document.createElement('baja-race-clock') as RaceClockGraphic;
  previewStage.append(raceClock);

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => raceClock.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => raceClock.stopAction({}), 'offAir');
  });
  for (const flagState of flagStates) {
    addPreviewButton(ptBR.preview.flagButton(ptBR.flagLabels[flagState]), () => {
      const flagUpdate = { data: { state: flagState } };
      void runActionAndShowAnswer(
        'updateAction',
        () => raceClock.updateAction(flagUpdate),
        'onAir',
      );
    });
  }

  // The same "now" the graphic counts with, so the sample reading and the clock drawn
  // from it share one clock. On this page no renderer records the server's time, so it
  // is simply this machine's clock.
  const dataChoice = choosePreviewData(location.search, readServerAlignedTimeMs());
  if (!dataChoice.isReadable) {
    previewLastAnswer.textContent = dataChoice.problem;
    setPreviewState('error');
    return;
  }

  await runActionAndShowAnswer(
    'load',
    () =>
      raceClock.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (document.body.dataset.previewState === 'offAir') {
    await runActionAndShowAnswer('playAction', () => raceClock.playAction({}), 'onAir');
  }
}

void startPreview();

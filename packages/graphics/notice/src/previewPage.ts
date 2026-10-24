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

import NoticeGraphic from './notice.js';
import type { OGrafReturnPayload } from './ografGraphicTypes.js';
import { choosePreviewData, createFastestLapSample, createPenaltySample } from './previewData.js';
import { ptBR } from './ptBR.js';

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
    previewLastAnswer.textContent = dataChoice.problem;
    setPreviewState('error');
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
  if (document.body.dataset.previewState === 'offAir') {
    await runActionAndShowAnswer('playAction', () => notice.playAction({}), 'onAir');
  }
}

void startPreview();

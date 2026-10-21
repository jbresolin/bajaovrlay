/**
 * Wires preview.html: registers the graphic as a renderer would, loads it with the data
 * from `?data=` (or the enduro sample), plays it in, and adds buttons for play, stop,
 * the two layouts, the three position changes of the motion demo (3rd and 4th trading
 * places, a new leader, car 21 climbing onto page 1), the next page and the two paging
 * modes. `data-preview-state` on <body> tells tests and people what happened last:
 * loading, busy, onAir, offAir or error.
 *
 * The theme's tokens and font are imported here from the theme package, so the preview
 * looks like the air without a server; on air the renderer page links the same two files
 * from /theme/ (packages/theme/README.md). The page keeps the list it last sent, so each
 * position-change button builds on the one before, as a timing system's polls do.
 */
import '@bajaovrlay/theme/ardosia/tokens.css';
import '@bajaovrlay/theme/fonts/fonts.css';

import type { OGrafReturnPayload } from './ografGraphicTypes.js';
import PositionsTowerGraphic from './positions-tower.js';
import {
  parseCompletePositionsTowerData,
  type PositionsTowerData,
  type TowerEntry,
} from './positionsTowerModel.js';
import { choosePreviewData, swapCarsAtPositions } from './previewData.js';
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

  customElements.define('baja-positions-tower', PositionsTowerGraphic);
  const tower = document.createElement('baja-positions-tower') as PositionsTowerGraphic;
  previewStage.append(tower);

  // The list the page last sent; the position-change buttons build on it.
  let entriesLastSent: TowerEntry[] = [];

  function sendUpdate(update: Partial<PositionsTowerData>): void {
    void runActionAndShowAnswer(
      'updateAction',
      () => tower.updateAction({ data: update }),
      'onAir',
    );
  }

  function sendEntries(entries: TowerEntry[]): void {
    entriesLastSent = entries;
    sendUpdate({ entries });
  }

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => tower.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => tower.stopAction({}), 'offAir');
  });
  addPreviewButton(ptBR.preview.compactLayoutButton, () => sendUpdate({ layout: 'compact' }));
  addPreviewButton(ptBR.preview.detailedLayoutButton, () => sendUpdate({ layout: 'detailed' }));
  addPreviewButton(ptBR.preview.swapThirdAndFourthButton, () => {
    sendEntries(swapCarsAtPositions(entriesLastSent, 3, 4));
  });
  addPreviewButton(ptBR.preview.newLeaderButton, () => {
    sendEntries(swapCarsAtPositions(entriesLastSent, 1, 2));
  });
  addPreviewButton(ptBR.preview.carCrossesPageBoundaryButton, () => {
    sendEntries(swapCarsAtPositions(entriesLastSent, 20, 21));
  });
  addPreviewButton(ptBR.preview.nextPageButton, () => {
    void runActionAndShowAnswer(
      'turnToTheNextPageNow',
      async () => {
        await tower.turnToTheNextPageNow();
        return { statusCode: 200 };
      },
      'onAir',
    );
  });
  addPreviewButton(ptBR.preview.firstPageOnlyButton, () => sendUpdate({ paging: 'firstPageOnly' }));
  addPreviewButton(ptBR.preview.cyclePagesButton, () => sendUpdate({ paging: 'cycle' }));

  const dataChoice = choosePreviewData(location.search);
  if (!dataChoice.isReadable) {
    previewLastAnswer.textContent = dataChoice.problem;
    setPreviewState('error');
    return;
  }
  // The buttons build on the list loaded; data the graphic refuses leaves it empty.
  const loadedDataCheck = parseCompletePositionsTowerData(dataChoice.data);
  entriesLastSent = loadedDataCheck.isValid ? loadedDataCheck.data.entries : [];

  await runActionAndShowAnswer(
    'load',
    () =>
      tower.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (document.body.dataset.previewState === 'offAir') {
    await runActionAndShowAnswer('playAction', () => tower.playAction({}), 'onAir');
  }
}

void startPreview();

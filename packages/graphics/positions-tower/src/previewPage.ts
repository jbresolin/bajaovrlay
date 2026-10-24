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

import { setUpPreviewControls } from '@bajaovrlay/graphics-kit/previewControls';

import PositionsTowerGraphic from './positions-tower.js';
import {
  parseCompletePositionsTowerData,
  type PositionsTowerData,
  type TowerEntry,
} from './positionsTowerModel.js';
import { choosePreviewData, swapCarsAtPositions } from './previewData.js';
import { ptBR } from './ptBR.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

async function startPreview(): Promise<void> {
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
    showProblem(dataChoice.problem);
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
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => tower.playAction({}), 'onAir');
  }
}

void startPreview();

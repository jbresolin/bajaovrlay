/**
 * Wires preview.html: registers the graphic as a renderer would, loads it with the data
 * from `?data=` (or the qualifying page), plays it in, and adds buttons for play, stop, the
 * next page, the three sample pages and "Ordenar por melhor volta". `?stage=grey|black`
 * puts the design's screenshot backgrounds behind it. `data-preview-state` on <body> tells
 * tests and people what happened last: loading, busy, onAir, offAir or error.
 *
 * The theme's tokens and font are imported here from the theme package, so the preview
 * looks like the air without a server.
 */
import '@bajaovrlay/theme/ardosia/tokens.css';
import '@bajaovrlay/theme/fonts/fonts.css';

import { setUpPreviewControls } from '@bajaovrlay/graphics-kit/previewControls';
import { choosePreviewStage } from '@bajaovrlay/graphics-kit/previewStage';

import {
  choosePreviewData,
  createEnduroPage,
  createOverallPageDuringSpoilers,
  createQualifyingPage,
} from './previewData.js';
import { ptBR } from './ptBR.js';
import ResultsTableGraphic from './resultsTable.js';
import type { ResultsTableData } from './resultsTableModel.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

async function startPreview(): Promise<void> {
  previewStage.dataset.stage = choosePreviewStage(location.search);
  customElements.define('baja-results-table', ResultsTableGraphic);
  const resultsTable = document.createElement('baja-results-table') as ResultsTableGraphic;
  previewStage.append(resultsTable);

  function sendUpdate(update: Partial<ResultsTableData>): void {
    void runActionAndShowAnswer(
      'updateAction',
      () => resultsTable.updateAction({ data: update }),
      'onAir',
    );
  }

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => resultsTable.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => resultsTable.stopAction({}), 'offAir');
  });
  addPreviewButton(ptBR.preview.nextPageButton, () => {
    // Off air the board rests on page 1 and turns no page; the button does nothing.
    if (readPreviewState() !== 'onAir') {
      return;
    }
    void runActionAndShowAnswer(
      'turnToTheNextPageNow',
      async () => {
        await resultsTable.turnToTheNextPageNow();
        return { statusCode: 200 };
      },
      'onAir',
    );
  });
  addPreviewButton(ptBR.preview.spoilersButton, () =>
    sendUpdate(createOverallPageDuringSpoilers()),
  );
  addPreviewButton(ptBR.preview.qualifyingButton, () => sendUpdate(createQualifyingPage()));
  addPreviewButton(ptBR.preview.enduroButton, () => sendUpdate(createEnduroPage()));
  addPreviewButton(ptBR.preview.sortByBestLapButton, () =>
    sendUpdate({ sortByColumn: 'Melhor volta', sortDirection: 'ascending' }),
  );

  const dataChoice = choosePreviewData(location.search);
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }
  await runActionAndShowAnswer(
    'load',
    () =>
      resultsTable.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => resultsTable.playAction({}), 'onAir');
  }
}

void startPreview();

/**
 * Wires preview.html: registers the graphic as a renderer would, loads it with the data
 * from `?data=` (or the real overall standings with their parts), plays it in, and adds
 * buttons for play, stop, the next page, the three samples (the overall table with its
 * parts, the overall total alone in columns, the enduro's own table in columns) and a
 * team disqualified on air. `?stage=grey|black` puts the design's screenshot backgrounds
 * behind it instead of the gradient. `data-preview-state` on <body> tells tests and people
 * what happened last: loading, busy, onAir, offAir or error.
 *
 * The theme's tokens and font are imported here from the theme package, so the preview
 * looks like the air without a server. The page keeps the list it last sent, so the
 * disqualify button builds on the one before, as a source's polls do.
 */
import '@bajaovrlay/theme/ardosia/tokens.css';
import '@bajaovrlay/theme/fonts/fonts.css';

import { setUpPreviewControls } from '@bajaovrlay/graphics-kit/previewControls';

import {
  choosePreviewData,
  choosePreviewStage,
  createEnduroStandings,
  createOverallStandingsTotalOnly,
  createOverallStandingsWithParts,
  disqualifyTeamInRow,
} from './previewData.js';
import { ptBR } from './ptBR.js';
import StandingsGraphic from './standings.js';
import {
  parseCompleteStandingsData,
  type StandingsData,
  type StandingsEntry,
} from './standingsModel.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

async function startPreview(): Promise<void> {
  previewStage.dataset.stage = choosePreviewStage(location.search);
  customElements.define('baja-standings', StandingsGraphic);
  const standings = document.createElement('baja-standings') as StandingsGraphic;
  previewStage.append(standings);

  // The list the page last sent; the disqualify button builds on it.
  let entriesLastSent: StandingsEntry[] = [];

  function sendUpdate(update: Partial<StandingsData>): void {
    if (update.entries !== undefined) {
      entriesLastSent = update.entries;
    }
    void runActionAndShowAnswer(
      'updateAction',
      () => standings.updateAction({ data: update }),
      'onAir',
    );
  }

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => standings.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => standings.stopAction({}), 'offAir');
  });
  addPreviewButton(ptBR.preview.nextPageButton, () => {
    void runActionAndShowAnswer(
      'turnToTheNextPageNow',
      async () => {
        await standings.turnToTheNextPageNow();
        return { statusCode: 200 };
      },
      'onAir',
    );
  });
  addPreviewButton(ptBR.preview.withPartsButton, () =>
    sendUpdate(createOverallStandingsWithParts()),
  );
  addPreviewButton(ptBR.preview.totalOnlyButton, () =>
    sendUpdate(createOverallStandingsTotalOnly()),
  );
  addPreviewButton(ptBR.preview.perEventButton, () => sendUpdate(createEnduroStandings()));
  addPreviewButton(ptBR.preview.disqualifyButton, () => {
    sendUpdate({ entries: disqualifyTeamInRow(entriesLastSent, 3) });
  });

  const dataChoice = choosePreviewData(location.search);
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }
  // The buttons build on the list loaded; data the graphic refuses leaves it empty.
  const loadedDataCheck = parseCompleteStandingsData(dataChoice.data);
  entriesLastSent = loadedDataCheck.isValid ? loadedDataCheck.data.entries : [];

  await runActionAndShowAnswer(
    'load',
    () =>
      standings.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => standings.playAction({}), 'onAir');
  }
}

void startPreview();

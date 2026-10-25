/**
 * Wires preview.html: sets the stage from `?stage=`, registers the graphic as a renderer
 * would, loads it with the data from the address (previewData.ts), plays it in, and adds
 * buttons for play, stop and each optional part (the top five, the sponsors) on and off.
 * `data-preview-state` on <body> tells tests and people what happened last.
 *
 * The theme's tokens and font are imported here from the theme package, so the preview
 * looks like the air without a server.
 */
import '@bajaovrlay/theme/ardosia/tokens.css';
import '@bajaovrlay/theme/fonts/fonts.css';

import { setUpPreviewControls } from '@bajaovrlay/graphics-kit/previewControls';
import { choosePreviewStage } from '@bajaovrlay/graphics-kit/previewStage';
import { createThe30thCompetitionSponsorsSample } from '@bajaovrlay/graphics-kit/the30thCompetitionSponsorsSample';

import IntermissionBoardGraphic from './intermission-board.js';
import { choosePreviewData, createThe30thCompetitionTopFive } from './previewData.js';
import { ptBR } from './ptBR.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

/**
 * Sends one update. A part switched off is sent as undefined, which the in-page call keeps
 * and the merge then clears, as the renderer sends a field that left the data.
 */
function sendUpdate(board: IntermissionBoardGraphic, data: Record<string, unknown>): void {
  const stateAfterUpdate = readPreviewState() === 'offAir' ? 'offAir' : 'onAir';
  void runActionAndShowAnswer('updateAction', () => board.updateAction({ data }), stateAfterUpdate);
}

/** Adds the on and off buttons of the two optional parts. */
function addPartButtons(board: IntermissionBoardGraphic): void {
  const partButtons: Array<[string, Record<string, unknown>]> = [
    [ptBR.preview.topFiveOnButton, { topFive: createThe30thCompetitionTopFive() }],
    [ptBR.preview.topFiveOffButton, { topFive: undefined }],
    [ptBR.preview.sponsorsOnButton, { sponsors: createThe30thCompetitionSponsorsSample() }],
    [ptBR.preview.sponsorsOffButton, { sponsors: undefined }],
  ];
  for (const [label, data] of partButtons) {
    addPreviewButton(label, () => sendUpdate(board, data));
  }
}

async function startPreview(): Promise<void> {
  document.body.dataset.stage = choosePreviewStage(location.search);
  customElements.define('baja-intermission-board', IntermissionBoardGraphic);
  const board = document.createElement('baja-intermission-board') as IntermissionBoardGraphic;
  previewStage.append(board);

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => board.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => board.stopAction({}), 'offAir');
  });
  addPartButtons(board);

  const dataChoice = choosePreviewData(location.search, Date.now());
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }
  await runActionAndShowAnswer(
    'load',
    () =>
      board.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => board.playAction({}), 'onAir');
  }
}

void startPreview();

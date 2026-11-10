/**
 * Wires preview.html: sets the stage from `?stage=`, registers the graphic as a renderer
 * would, loads it with the data from the address (previewData.ts), plays it in, and adds
 * buttons for play, stop and each of the four corners. `data-preview-state` on <body>
 * tells tests and people what happened last: loading, busy, onAir, offAir or error.
 *
 * The theme's tokens and font are imported here from the theme package, so the preview
 * looks like the air without a server; on air the renderer page links the same files.
 */
import '@bajaovrlay/theme/ardosia/tokens.css';
import '@bajaovrlay/theme/fonts/fonts.css';

import { setUpPreviewControls } from '@bajaovrlay/graphics-kit/previewControls';
import { choosePreviewStage } from '@bajaovrlay/graphics-kit/previewStage';
import {
  screenCornerNamesInPortuguese,
  screenCorners,
} from '@bajaovrlay/graphics-kit/screenCornerPosition';

import BracketMatchBugGraphic from './bracket-match-bug.js';
import { choosePreviewData } from './previewData.js';
import { ptBR } from './ptBR.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

/** Adds one button per corner; each moves the bug there with an update, on air or off. */
function addCornerButtons(matchBug: BracketMatchBugGraphic): void {
  for (const corner of screenCorners) {
    addPreviewButton(ptBR.preview.cornerButton(screenCornerNamesInPortuguese[corner]), () => {
      const stateAfterUpdate = readPreviewState() === 'offAir' ? 'offAir' : 'onAir';
      void runActionAndShowAnswer(
        'updateAction',
        () => matchBug.updateAction({ data: { corner } }),
        stateAfterUpdate,
      );
    });
  }
}

async function startPreview(): Promise<void> {
  document.body.dataset.stage = choosePreviewStage(location.search);
  customElements.define('baja-bracket-match-bug', BracketMatchBugGraphic);
  const matchBug = document.createElement('baja-bracket-match-bug') as BracketMatchBugGraphic;
  previewStage.append(matchBug);

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => matchBug.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => matchBug.stopAction({}), 'offAir');
  });
  addCornerButtons(matchBug);

  const dataChoice = choosePreviewData(location.search);
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }

  await runActionAndShowAnswer(
    'load',
    () =>
      matchBug.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => matchBug.playAction({}), 'onAir');
  }
}

void startPreview();

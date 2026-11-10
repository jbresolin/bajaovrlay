/**
 * Wires preview.html: sets the stage from `?stage=`, registers the graphic as a renderer
 * would, loads it with the data from the address (previewData.ts), plays it in (its one pass
 * starts), and adds buttons for play, stop and each of the four corners. On a page with no
 * server nothing takes the roll off at the end of its pass: the last sponsor stays, as it
 * would if the clear came late. `data-preview-state` on <body> tells tests and people what
 * happened last: loading, busy, onAir, offAir or error.
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

import { choosePreviewData } from './previewData.js';
import { ptBR } from './ptBR.js';
import SponsorRollPlainGraphic from './sponsor-roll-plain.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

/** Adds one button per corner; each moves the card there with an update, on air or off. */
function addCornerButtons(plainRoll: SponsorRollPlainGraphic): void {
  for (const corner of screenCorners) {
    addPreviewButton(ptBR.preview.cornerButton(screenCornerNamesInPortuguese[corner]), () => {
      const stateAfterUpdate = readPreviewState() === 'offAir' ? 'offAir' : 'onAir';
      void runActionAndShowAnswer(
        'updateAction',
        () => plainRoll.updateAction({ data: { corner } }),
        stateAfterUpdate,
      );
    });
  }
}

async function startPreview(): Promise<void> {
  document.body.dataset.stage = choosePreviewStage(location.search);
  customElements.define('baja-sponsor-roll-plain', SponsorRollPlainGraphic);
  const plainRoll = document.createElement('baja-sponsor-roll-plain') as SponsorRollPlainGraphic;
  previewStage.append(plainRoll);

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => plainRoll.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => plainRoll.stopAction({}), 'offAir');
  });
  addCornerButtons(plainRoll);

  const dataChoice = choosePreviewData(location.search);
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }

  await runActionAndShowAnswer(
    'load',
    () =>
      plainRoll.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => plainRoll.playAction({}), 'onAir');
  }
}

void startPreview();

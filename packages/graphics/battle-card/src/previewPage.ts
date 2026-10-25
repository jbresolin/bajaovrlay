/**
 * Wires preview.html: sets the stage from `?stage=`, registers the graphic as a renderer
 * would, loads it with the data from the address (previewData.ts), plays it in, and adds
 * buttons for play, stop and "Atualizar", which sends the next lap's reading as an update
 * (after the last one it starts the round again, the laps still growing).
 * `data-preview-state` on <body> tells tests and people what happened last: loading,
 * busy, onAir, offAir or error.
 *
 * The theme's tokens and font are imported here from the theme package, so the preview
 * looks like the air without a server; on air the renderer page links the same two files
 * from /theme/ (packages/theme/README.md).
 */
import '@bajaovrlay/theme/ardosia/tokens.css';
import '@bajaovrlay/theme/fonts/fonts.css';

import { setUpPreviewControls } from '@bajaovrlay/graphics-kit/previewControls';
import { choosePreviewStage } from '@bajaovrlay/graphics-kit/previewStage';

import BattleCardGraphic from './battle-card.js';
import { choosePreviewData, listPreviewLapReadings } from './previewData.js';
import { ptBR } from './ptBR.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

/**
 * Adds "Atualizar": each press sends the next reading of the round; a later round adds the
 * round's laps, so the car behind's laps keep growing and the trend keeps being compared.
 */
function addUpdateButton(battleCard: BattleCardGraphic): void {
  const readings = listPreviewLapReadings();
  let pressCount = 0;
  addPreviewButton(ptBR.preview.updateButton, () => {
    const placeInRound = pressCount % readings.length;
    const roundNumber = Math.floor(pressCount / readings.length);
    pressCount += 1;
    const reading = readings[placeInRound];
    if (reading === undefined) {
      return;
    }
    const lapsOfEarlierRounds = roundNumber * readings.length;
    const update = {
      data: {
        aheadLaps: reading.aheadLaps + lapsOfEarlierRounds,
        behindLaps: reading.behindLaps + lapsOfEarlierRounds,
        gapMs: reading.gapMs,
      },
    };
    const stateAfterUpdate = readPreviewState() === 'offAir' ? 'offAir' : 'onAir';
    void runActionAndShowAnswer(
      'updateAction',
      () => battleCard.updateAction(update),
      stateAfterUpdate,
    );
  });
}

async function startPreview(): Promise<void> {
  document.body.dataset.stage = choosePreviewStage(location.search);
  customElements.define('baja-battle-card', BattleCardGraphic);
  const battleCard = document.createElement('baja-battle-card') as BattleCardGraphic;
  previewStage.append(battleCard);

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => battleCard.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => battleCard.stopAction({}), 'offAir');
  });
  addUpdateButton(battleCard);

  const dataChoice = choosePreviewData(location.search);
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }

  await runActionAndShowAnswer(
    'load',
    () =>
      battleCard.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => battleCard.playAction({}), 'onAir');
  }
}

void startPreview();

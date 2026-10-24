/**
 * Wires preview.html: registers the graphic as a renderer would, loads it with the data
 * from `?data=` (or the running enduro sample), plays it in, and adds buttons for play,
 * stop, each flag state and the band switch. `data-preview-state` on <body> tells tests
 * and people what happened last: loading, busy, onAir, offAir or error.
 *
 * The theme's tokens and font are imported here from the theme package, so the preview
 * looks like the air without a server; on air the renderer page links the same two files
 * from /theme/ (packages/theme/README.md).
 */
import '@bajaovrlay/theme/ardosia/tokens.css';
import '@bajaovrlay/theme/fonts/fonts.css';

import { setUpPreviewControls } from '@bajaovrlay/graphics-kit/previewControls';
import { readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';

import { choosePreviewData } from './previewData.js';
import { ptBR } from './ptBR.js';
import RaceClockGraphic from './race-clock.js';
import { flagStates } from './raceClockModel.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

async function startPreview(): Promise<void> {
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
  addPreviewButton(ptBR.preview.flagBandOnButton, () => {
    const bandOnUpdate = { data: { showFlagBand: true } };
    void runActionAndShowAnswer(
      'updateAction',
      () => raceClock.updateAction(bandOnUpdate),
      'onAir',
    );
  });
  addPreviewButton(ptBR.preview.flagBandOffButton, () => {
    const bandOffUpdate = { data: { showFlagBand: false } };
    void runActionAndShowAnswer(
      'updateAction',
      () => raceClock.updateAction(bandOffUpdate),
      'onAir',
    );
  });

  // The same "now" the graphic counts with, so the sample reading and the clock drawn
  // from it share one clock. On this page no renderer records the server's time, so it
  // is simply this machine's clock.
  const dataChoice = choosePreviewData(location.search, readServerAlignedTimeMs());
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
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
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => raceClock.playAction({}), 'onAir');
  }
}

void startPreview();

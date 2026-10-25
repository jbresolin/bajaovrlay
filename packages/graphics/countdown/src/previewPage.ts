/**
 * Wires preview.html: sets the stage from `?stage=`, registers the graphic as a renderer
 * would, loads it with the data from the address (previewData.ts), plays it in, and adds
 * buttons for play, stop, the two layouts and a start ten minutes later (an edit of the
 * schedule, as the live refresh sends it). `data-preview-state` on <body> tells tests and
 * people what happened last: loading, busy, onAir, offAir or error.
 *
 * The theme's tokens and font are imported here from the theme package, so the preview
 * looks like the air without a server; on air the renderer page links the same two files
 * from /theme/ (packages/theme/README.md).
 */
import '@bajaovrlay/theme/ardosia/tokens.css';
import '@bajaovrlay/theme/fonts/fonts.css';

import { setUpPreviewControls } from '@bajaovrlay/graphics-kit/previewControls';
import { choosePreviewStage } from '@bajaovrlay/graphics-kit/previewStage';

import CountdownGraphic from './countdown.js';
import type { CountdownLayout } from './countdownModel.js';
import { choosePreviewData } from './previewData.js';
import { ptBR } from './ptBR.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

/** Sends one update, leaving the page on air or off air as it was. */
function sendUpdate(countdown: CountdownGraphic, data: Record<string, unknown>): void {
  const stateAfterUpdate = readPreviewState() === 'offAir' ? 'offAir' : 'onAir';
  void runActionAndShowAnswer(
    'updateAction',
    () => countdown.updateAction({ data }),
    stateAfterUpdate,
  );
}

/** Adds the buttons of the two layouts and of a start moved ten minutes later. */
function addDataButtons(countdown: CountdownGraphic, firstStartsAtMs: number): void {
  let startsAtMs = firstStartsAtMs;
  const layoutButtons: Array<[string, CountdownLayout]> = [
    [ptBR.preview.cardButton, 'card'],
    [ptBR.preview.fullscreenButton, 'fullscreen'],
  ];
  for (const [label, layout] of layoutButtons) {
    addPreviewButton(label, () => sendUpdate(countdown, { layout }));
  }
  addPreviewButton(ptBR.preview.tenMinutesLaterButton, () => {
    startsAtMs += 10 * 60 * 1000;
    sendUpdate(countdown, { startsAtMs });
  });
}

/** Reads the start of the data the preview loads, for the "later" button; 0 when none. */
function readStartOfData(data: unknown): number {
  const isObject = typeof data === 'object' && data !== null;
  const startsAtMs = isObject && 'startsAtMs' in data ? data.startsAtMs : undefined;
  return typeof startsAtMs === 'number' ? startsAtMs : 0;
}

async function startPreview(): Promise<void> {
  document.body.dataset.stage = choosePreviewStage(location.search);
  customElements.define('baja-countdown', CountdownGraphic);
  const countdown = document.createElement('baja-countdown') as CountdownGraphic;
  previewStage.append(countdown);

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => countdown.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => countdown.stopAction({}), 'offAir');
  });

  const dataChoice = choosePreviewData(location.search, Date.now());
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }
  addDataButtons(countdown, readStartOfData(dataChoice.data));

  await runActionAndShowAnswer(
    'load',
    () =>
      countdown.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => countdown.playAction({}), 'onAir');
  }
}

void startPreview();

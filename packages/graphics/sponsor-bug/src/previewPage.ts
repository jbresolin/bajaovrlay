/**
 * Wires preview.html: sets the stage from `?stage=`, registers the graphic as a renderer
 * would, loads it with the data from the address (previewData.ts), plays it in, and adds
 * buttons for play, stop and each optional part (sponsor, event word, plate) on and off.
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

import {
  choosePreviewData,
  createEnduroBugSample,
  everySamplePartOn,
  type SampleParts,
} from './previewData.js';
import { ptBR } from './ptBR.js';
import SponsorBugGraphic from './sponsor-bug.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

/**
 * Sends the sample with the given parts as one update. A part switched off is sent as
 * undefined, which the in-page call keeps and the merge then clears; a renderer on the
 * wire would send the whole data instead, since JSON drops undefined.
 */
function sendSampleWithParts(sponsorBug: SponsorBugGraphic, parts: SampleParts): void {
  const everyOptionalPartCleared = { eventWord: undefined, sponsorLogoUrl: undefined };
  const update = { data: { ...everyOptionalPartCleared, ...createEnduroBugSample(parts) } };
  const stateAfterUpdate = readPreviewState() === 'offAir' ? 'offAir' : 'onAir';
  void runActionAndShowAnswer(
    'updateAction',
    () => sponsorBug.updateAction(update),
    stateAfterUpdate,
  );
}

/** Adds the on and off buttons of every optional part; each keeps the other parts as they are. */
function addPartButtons(sponsorBug: SponsorBugGraphic): void {
  let currentParts: SampleParts = { ...everySamplePartOn };
  const partButtons: Array<[string, Partial<SampleParts>]> = [
    [ptBR.preview.sponsorOnButton, { hasSponsor: true }],
    [ptBR.preview.sponsorOffButton, { hasSponsor: false }],
    [ptBR.preview.eventWordOnButton, { hasEventWord: true }],
    [ptBR.preview.eventWordOffButton, { hasEventWord: false }],
    [ptBR.preview.plateOnButton, { isSponsorLogoOnLightPlate: true }],
    [ptBR.preview.plateOffButton, { isSponsorLogoOnLightPlate: false }],
  ];
  for (const [label, partChange] of partButtons) {
    addPreviewButton(label, () => {
      currentParts = { ...currentParts, ...partChange };
      sendSampleWithParts(sponsorBug, currentParts);
    });
  }
}

async function startPreview(): Promise<void> {
  document.body.dataset.stage = choosePreviewStage(location.search);
  customElements.define('baja-sponsor-bug', SponsorBugGraphic);
  const sponsorBug = document.createElement('baja-sponsor-bug') as SponsorBugGraphic;
  previewStage.append(sponsorBug);

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => sponsorBug.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => sponsorBug.stopAction({}), 'offAir');
  });
  addPartButtons(sponsorBug);

  const dataChoice = choosePreviewData(location.search);
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }

  await runActionAndShowAnswer(
    'load',
    () =>
      sponsorBug.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => sponsorBug.playAction({}), 'onAir');
  }
}

void startPreview();

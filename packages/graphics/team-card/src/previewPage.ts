/**
 * Wires preview.html: sets the stage from `?stage=`, registers the graphic as a renderer
 * would, loads it with the data from the address (previewData.ts), plays it in, and adds
 * buttons for play, stop and each optional part (photo, logo, city, plate) on and off.
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
  createReptilesSample,
  everySamplePartOn,
  type SampleParts,
} from './previewData.js';
import { ptBR } from './ptBR.js';
import TeamCardGraphic from './team-card.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

/**
 * Sends the sample with the given parts as one update. A part switched off is sent as
 * undefined, which the in-page call keeps and the merge then clears; a renderer on the
 * wire would send the whole data instead, since JSON drops undefined.
 */
function sendSampleWithParts(teamCard: TeamCardGraphic, parts: SampleParts): void {
  const everyOptionalPartCleared = {
    city: undefined,
    state: undefined,
    carPhotoUrl: undefined,
    logoUrl: undefined,
  };
  const update = { data: { ...everyOptionalPartCleared, ...createReptilesSample(parts) } };
  const stateAfterUpdate = readPreviewState() === 'offAir' ? 'offAir' : 'onAir';
  void runActionAndShowAnswer(
    'updateAction',
    () => teamCard.updateAction(update),
    stateAfterUpdate,
  );
}

/** Adds the on and off buttons of every optional part; each keeps the other parts as they are. */
function addPartButtons(teamCard: TeamCardGraphic): void {
  let currentParts: SampleParts = { ...everySamplePartOn };
  const partButtons: Array<[string, Partial<SampleParts>]> = [
    [ptBR.preview.photoOnButton, { hasPhoto: true }],
    [ptBR.preview.photoOffButton, { hasPhoto: false }],
    [ptBR.preview.logoOnButton, { hasLogo: true }],
    [ptBR.preview.logoOffButton, { hasLogo: false }],
    [ptBR.preview.cityOnButton, { hasCity: true }],
    [ptBR.preview.cityOffButton, { hasCity: false }],
    [ptBR.preview.plateOnButton, { isLogoOnLightPlate: true }],
    [ptBR.preview.plateOffButton, { isLogoOnLightPlate: false }],
  ];
  for (const [label, partChange] of partButtons) {
    addPreviewButton(label, () => {
      currentParts = { ...currentParts, ...partChange };
      sendSampleWithParts(teamCard, currentParts);
    });
  }
}

async function startPreview(): Promise<void> {
  document.body.dataset.stage = choosePreviewStage(location.search);
  customElements.define('baja-team-card', TeamCardGraphic);
  const teamCard = document.createElement('baja-team-card') as TeamCardGraphic;
  previewStage.append(teamCard);

  addPreviewButton(ptBR.preview.playButton, () => {
    void runActionAndShowAnswer('playAction', () => teamCard.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    void runActionAndShowAnswer('stopAction', () => teamCard.stopAction({}), 'offAir');
  });
  addPartButtons(teamCard);

  const dataChoice = choosePreviewData(location.search);
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }

  await runActionAndShowAnswer(
    'load',
    () =>
      teamCard.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    await runActionAndShowAnswer('playAction', () => teamCard.playAction({}), 'onAir');
  }
}

void startPreview();

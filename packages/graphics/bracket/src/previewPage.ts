/**
 * Wires preview.html: sets the stage from `?stage=`, registers the graphic as a renderer
 * would, loads it with the data from the address (previewData.ts), plays it in (its first
 * step), and adds buttons for play, Próximo (the next step, then off air past the last),
 * stop, the three samples (the real Super Prime, the results on a board, in a tree) and a
 * result arriving on air (the undecided match of the results decided, to see the
 * crossfade). `data-preview-state` on <body> tells tests and people what happened last:
 * loading, busy, onAir, offAir or error.
 *
 * The theme's tokens and font are imported here from the theme package, so the preview
 * looks like the air without a server; on air the renderer page links the same two files
 * from /theme/ (packages/theme/README.md).
 */
import '@bajaovrlay/theme/ardosia/tokens.css';
import '@bajaovrlay/theme/fonts/fonts.css';

import { setUpPreviewControls } from '@bajaovrlay/graphics-kit/previewControls';
import { choosePreviewStage } from '@bajaovrlay/graphics-kit/previewStage';

import BracketGraphic from './bracket.js';
import { type BracketData, parseCompleteBracketData } from './bracketModel.js';
import { countStepsOfBracket } from './bracketStepView.js';
import {
  choosePreviewData,
  createResultStatesInATree,
  createResultStatesOnABoard,
  createTheRealSuperPrime,
} from './previewData.js';
import { ptBR } from './ptBR.js';

const { previewStage, addPreviewButton, runActionAndShowAnswer, showProblem, readPreviewState } =
  setUpPreviewControls(ptBR.preview);

/** The results of `data` with their undecided match decided for car 32, as a result arriving. */
function decideTheUndecidedMatch(data: BracketData): BracketData {
  return {
    ...data,
    rounds: data.rounds.map((round) => ({
      ...round,
      matches: round.matches.map((match) =>
        match.winnerCarNumber === undefined && match.carB !== undefined
          ? { ...match, winnerCarNumber: match.carA.carNumber }
          : match,
      ),
    })),
  };
}

async function startPreview(): Promise<void> {
  previewStage.dataset.stage = choosePreviewStage(location.search);
  customElements.define('baja-bracket', BracketGraphic);
  const bracket = document.createElement('baja-bracket') as BracketGraphic;
  previewStage.append(bracket);

  // The data and the step on air as this page drove them (no step off air), so Próximo
  // knows when the next press takes the bracket off air (past its last step).
  let dataSent: BracketData | undefined;
  let stepOnAir: number | undefined;

  /** Sends a sample as one update, as a binding's refresh would. */
  const sendSample = (sample: BracketData) => {
    dataSent = sample;
    const stateAfterUpdate = readPreviewState() === 'offAir' ? 'offAir' : 'onAir';
    void runActionAndShowAnswer(
      'updateAction',
      () => bracket.updateAction({ data: sample }),
      stateAfterUpdate,
    );
  };

  addPreviewButton(ptBR.preview.playButton, () => {
    stepOnAir ??= 0;
    void runActionAndShowAnswer('playAction', () => bracket.playAction({}), 'onAir');
  });
  addPreviewButton(ptBR.preview.nextButton, () => {
    // Off air, a play would bring the first step in, which is the play button's job.
    if (readPreviewState() !== 'onAir' || stepOnAir === undefined || dataSent === undefined) {
      return;
    }
    const stepAfterThePress = stepOnAir + 1;
    const isTheEnd = stepAfterThePress >= countStepsOfBracket(dataSent);
    stepOnAir = isTheEnd ? undefined : stepAfterThePress;
    void runActionAndShowAnswer(
      'playAction',
      () => bracket.playAction({}),
      isTheEnd ? 'offAir' : 'onAir',
    );
  });
  addPreviewButton(ptBR.preview.stopButton, () => {
    stepOnAir = undefined;
    void runActionAndShowAnswer('stopAction', () => bracket.stopAction({}), 'offAir');
  });
  addPreviewButton(ptBR.preview.superPrimeButton, () => sendSample(createTheRealSuperPrime()));
  addPreviewButton(ptBR.preview.resultsBoardButton, () => sendSample(createResultStatesOnABoard()));
  addPreviewButton(ptBR.preview.resultsTreeButton, () => sendSample(createResultStatesInATree()));
  addPreviewButton(ptBR.preview.liveResultButton, () => {
    if (dataSent !== undefined) {
      sendSample(decideTheUndecidedMatch(dataSent));
    }
  });

  const dataChoice = choosePreviewData(location.search);
  if (!dataChoice.isReadable) {
    showProblem(dataChoice.problem);
    return;
  }
  const dataCheck = parseCompleteBracketData(dataChoice.data);
  dataSent = dataCheck.isValid ? dataCheck.data : undefined;

  await runActionAndShowAnswer(
    'load',
    () =>
      bracket.load({
        data: dataChoice.data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      }),
    'offAir',
  );
  if (readPreviewState() === 'offAir') {
    stepOnAir = 0;
    await runActionAndShowAnswer('playAction', () => bracket.playAction({}), 'onAir');
  }
}

void startPreview();

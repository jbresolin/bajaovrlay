/**
 * The bracket OGraf graphic: an elimination on the fullscreen layer, one step per
 * "Próximo" (catalogue entry 4). This file owns the OGraf lifecycle (load, play, update,
 * stop, dispose) and wires the rest: bracketModel (data), bracketStepView (what a step
 * shows, on the shared step plan the server counts with), bracketView (the DOM, drawn by
 * Lit from the data and the step), bracketStepMoves (which pieces a step brings in, lifts
 * out or shows at once) on bracketAnimations (GSAP timelines from the theme's motion
 * tokens), the kit's wideBoardHead, playSteps (the OGraf step rule) and motion timeline
 * runner, and ptBR.
 *
 * The steps (stepCount -1 in the manifest, counted from the rounds: one per round-board
 * page, one per tree round, one for the third place): play from off air goes to step 0
 * (Entrar), each further play to the next (Próximo); a play past the last is the end and
 * takes the bracket off air. A `goto` forward brings the steps' pieces in; a `goto` back
 * draws the step at once, with no motion.
 *
 * The bracket has no timer: nothing on it moves by itself. An update on air redraws the
 * step in place: what it adds appears at once, a result arriving crossfades its cells, and
 * a step the new rounds no longer have is brought back to the last. An update during the
 * stop-out is only kept, and drawn once the pieces are gone.
 *
 * The renderer, not this module, picks the tag name and calls customElements.define, as
 * OGraf v1 expects of a graphic's default export.
 */
import { carChipStyles } from '@bajaovrlay/graphics-kit/carChipStyles';
import { createMotionTimelineRunner } from '@bajaovrlay/graphics-kit/motionTimelineRunner';
import type {
  OGrafCustomActionParams,
  OGrafGraphic,
  OGrafLoadParams,
  OGrafPlayActionParams,
  OGrafPlayActionReturnPayload,
  OGrafReturnPayload,
  OGrafStopActionParams,
  OGrafUpdateActionParams,
} from '@bajaovrlay/graphics-kit/ografGraphicTypes';
import { choosePlayActionTarget } from '@bajaovrlay/graphics-kit/playSteps';
import { teamWithSchoolStyles } from '@bajaovrlay/graphics-kit/teamWithSchoolStyles';
import { waitForImagesToSettle } from '@bajaovrlay/graphics-kit/waitForImagesToSettle';
import { wideBoardFrameStyles } from '@bajaovrlay/graphics-kit/wideBoardFrameStyles';
import { writeWideBoardHead } from '@bajaovrlay/graphics-kit/wideBoardHead';
import { wideBoardHeadStyles } from '@bajaovrlay/graphics-kit/wideBoardHeadStyles';
import { waitForThemeFontsToBeReady } from '@bajaovrlay/theme/fonts';
import { LitElement } from 'lit';

import { placeHeadOffAir } from './bracketAnimations.js';
import { showWhatTheUpdateChanged, takeSnapshotOfTheStage } from './bracketLiveUpdates.js';
import {
  type BracketData,
  mergePartialUpdateIntoBracketData,
  parseCompleteBracketData,
  readBracketTitle,
} from './bracketModel.js';
import {
  buildLiftOutOfThePieces,
  buildRiseOfTheStep,
  chooseStepMoveKind,
  hideEveryPieceAtOnce,
  rememberPiecesOnScreen,
  showEveryPieceAtOnce,
  stepBeforeTheStart,
} from './bracketStepMoves.js';
import {
  countStepsOfBracket,
  describeStepOnScreen,
  writeStepLineOfBracket,
} from './bracketStepView.js';
import { bracketStyles } from './bracketStyles.js';
import { bracketTreeStyles } from './bracketTreeStyles.js';
import {
  type BracketOnScreen,
  type BracketParts,
  findBracketParts,
  renderBracketTemplate,
} from './bracketView.js';
import { ptBR } from './ptBR.js';
import { roundBoardStyles } from './roundBoardStyles.js';
import { readTreeGeometryOfTheTheme } from './treeGeometryTokens.js';
import type { TreeGeometry } from './treeLayout.js';

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The bracket graphic; the default export a renderer registers as a custom element. */
export default class BracketGraphic extends LitElement implements OGrafGraphic {
  static override styles = [
    wideBoardFrameStyles,
    wideBoardHeadStyles,
    carChipStyles,
    teamWithSchoolStyles,
    bracketStyles,
    roundBoardStyles,
    bracketTreeStyles,
  ];

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  // The latest data received; what is drawn may lag behind it during the stop-out.
  private data: BracketData | undefined = undefined;
  // Read by render(); not a Lit reactive property, so the stage is redrawn only when this
  // file asks (redrawAtStep), never by surprise.
  private onScreen: BracketOnScreen | undefined = undefined;
  private geometry: TreeGeometry | undefined = undefined;
  private parts: BracketParts | undefined = undefined;
  // The in, step and out motions, one at a time; the result crossfades apart, so a result
  // arriving never cuts a step's rise short.
  private readonly stepMotions = createMotionTimelineRunner();
  private readonly resultCrossfades = createMotionTimelineRunner();
  // Counts the plays and stops: a play overtaken by a later one (a double press, a stop)
  // gives the bracket up at its next await instead of drawing over the newer step.
  private moveNumber = 0;
  // The play whose lift-out to a new view is running, if any: an update meanwhile is only
  // kept, like one during the stop-out, and the play draws it once the old view is gone.
  private moveLiftingOutForANewView: number | undefined = undefined;

  override render() {
    return renderBracketTemplate(this.onScreen);
  }

  /**
   * OGraf load: checks the data, reads the theme's sizes for the tree, draws step 0 with
   * everything hidden, waits for the theme's font and the head's logo (at most 2 s), and
   * leaves the bracket off air. Loaded once; a second load answers 409.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompleteBracketData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';
    this.data = dataCheck.data;
    this.geometry = readTreeGeometryOfTheTheme(this);

    // Lit renders only connected elements: a load on an element not yet in the page
    // waits here until it is added.
    await this.redrawAtStep(dataCheck.data, 0);
    const parts = this.requireParts();
    placeHeadOffAir(parts.tokensSource, parts.head);
    hideEveryPieceAtOnce(parts);
    await waitForThemeFontsToBeReady(this);
    await waitForImagesToSettle(this.renderRoot);

    // A dispose that came while load was waiting must win.
    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    this.lifecycle = 'offAir';
    return okAnswer;
  }

  /**
   * OGraf playAction: from off air, brings the head and the step in; on air, moves to the
   * step asked (the next one by default). A step past the last means stop.
   */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const data = this.requireData();
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: countStepsOfBracket(data),
      goto: params.goto,
      delta: params.delta,
    });
    if (target.outcome === 'invalidStep') {
      return buildRefusalAnswer(400, ptBR.actionProblems.invalidPlayStep);
    }
    if (target.outcome === 'goToEnd') {
      const stopAnswer = await this.stopAction({ skipAnimation });
      return { ...stopAnswer, currentStep: undefined };
    }

    const isEntering = this.lifecycle !== 'onAir';
    const stepBefore = isEntering ? stepBeforeTheStart : (this.currentStep ?? 0);
    if (target.step === stepBefore) {
      return { statusCode: 200, currentStep: target.step };
    }
    this.moveNumber += 1;
    const moveNumberOfThisPlay = this.moveNumber;
    this.resultCrossfades.finishEveryTimelineAtOnce();
    this.lifecycle = 'onAir';
    this.currentStep = target.step;
    const parts = this.requireParts();
    const moveKind = chooseStepMoveKind(data, { stepBefore, targetStep: target.step, isEntering });

    if (moveKind === 'newView') {
      // An update during the lift-out is only kept (updateAction), drawn below once the old
      // view is gone: drawn now, the next board would pop in over the leaving one.
      this.moveLiftingOutForANewView = moveNumberOfThisPlay;
      await this.stepMotions.run(buildLiftOutOfThePieces(parts, false), skipAnimation);
      if (this.moveLiftingOutForANewView === moveNumberOfThisPlay) {
        this.moveLiftingOutForANewView = undefined;
      }
      if (this.moveNumber !== moveNumberOfThisPlay) {
        return this.answerAfterAnotherMoveTookOver();
      }
    }
    // The data may have changed during the lift-out: the latest is drawn, at a step it has,
    // as the server brings its own step back (gate 2 of PR #30).
    const dataNow = this.requireData();
    const stepNow = Math.min(target.step, countStepsOfBracket(dataNow) - 1);
    this.currentStep = stepNow;
    const piecesBefore = rememberPiecesOnScreen(parts);
    await this.redrawAtStep(dataNow, stepNow);
    if (moveKind === 'atOnce') {
      showEveryPieceAtOnce(parts);
      return { statusCode: 200, currentStep: stepNow };
    }
    await this.stepMotions.run(buildRiseOfTheStep(parts, moveKind, piecesBefore), skipAnimation);
    if (this.moveNumber !== moveNumberOfThisPlay) {
      return this.answerAfterAnotherMoveTookOver();
    }
    // An update during the rise is drawn in place, and may have brought the step back.
    return { statusCode: 200, currentStep: this.currentStep };
  }

  /**
   * OGraf stopAction: the head and everything on the stage lift out together; resolves once
   * they are gone, with every piece hidden for the next take.
   */
  async stopAction(params: OGrafStopActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    if (this.lifecycle === 'offAir') {
      return okAnswer;
    }
    this.moveNumber += 1;
    const moveNumberOfThisStop = this.moveNumber;
    this.lifecycle = 'offAir';
    this.currentStep = undefined;
    this.resultCrossfades.finishEveryTimelineAtOnce();
    const parts = this.requireParts();
    await this.stepMotions.run(buildLiftOutOfThePieces(parts, true), params.skipAnimation ?? false);

    // A play that came during the stop-out cut it short and owns the bracket now.
    if (this.moveNumber !== moveNumberOfThisStop || this.readLifecycleNow() !== 'offAir') {
      return okAnswer;
    }
    hideEveryPieceAtOnce(parts);
    if (this.onScreen?.data !== this.data) {
      await this.redrawAtStep(this.requireData(), 0);
      hideEveryPieceAtOnce(parts);
    }
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load, and redraws the step
   * in place with no motion: what the update adds appears at once, a result arriving
   * crossfades its cells, and a step the new rounds no longer have is brought back to the
   * last. During the stop-out, and during Próximo's lift-out to a new view, the data is
   * only kept, and drawn once the pieces are gone.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoBracketData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.data = dataCheck.data;
    const isStoppingOut = this.lifecycle === 'offAir' && this.stepMotions.isRunning();
    const isLiftingOutForANewView = this.moveLiftingOutForANewView !== undefined;
    if (isStoppingOut || isLiftingOutForANewView) {
      return okAnswer;
    }

    const parts = this.requireParts();
    if (this.lifecycle !== 'onAir') {
      await this.redrawAtStep(dataCheck.data, 0);
      hideEveryPieceAtOnce(parts);
      return okAnswer;
    }
    const lastStep = countStepsOfBracket(dataCheck.data) - 1;
    const stepOnAir = Math.min(this.currentStep ?? 0, lastStep);
    this.currentStep = stepOnAir;
    const stageBefore = takeSnapshotOfTheStage(parts);
    await this.redrawAtStep(dataCheck.data, stepOnAir);
    const crossfade = showWhatTheUpdateChanged(parts, stageBefore);
    if (crossfade !== undefined) {
      // Not awaited: the update is on screen now; the crossfade only softens it.
      void this.resultCrossfades.run(crossfade, false);
    }
    return okAnswer;
  }

  /** OGraf customAction: the bracket has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /** OGraf dispose: ends every running motion and crossfade; pending actions resolve. */
  async dispose(): Promise<OGrafReturnPayload> {
    this.lifecycle = 'disposed';
    this.moveNumber += 1;
    this.stepMotions.finishEveryTimelineAtOnce();
    this.resultCrossfades.finishEveryTimelineAtOnce();
    return okAnswer;
  }

  /**
   * Lit's hook for the element leaving the page: a running motion or crossfade is ended,
   * so a bracket a renderer removed without dispose leaves nothing animating behind it.
   */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stepMotions.finishEveryTimelineAtOnce();
    this.resultCrossfades.finishEveryTimelineAtOnce();
  }

  /** Draws the data at a step, waits until Lit has drawn it, and writes the head. */
  private async redrawAtStep(data: BracketData, stepIndex: number): Promise<void> {
    this.onScreen = { data, stepIndex, geometry: this.requireGeometry() };
    this.requestUpdate();
    await this.updateComplete;
    this.parts ??= findBracketParts(this.renderRoot, this);
    this.writeHeadNow(data, stepIndex);
  }

  /** Writes the head: the title, the board's round (none for the tree), the step line. */
  private writeHeadNow(data: BracketData, stepIndex: number): void {
    const step = describeStepOnScreen(data, stepIndex);
    writeWideBoardHead(this.requireParts(), {
      title: readBracketTitle(data),
      eventLine: step.kind === 'board' ? step.eventLine : '',
      pageLine: writeStepLineOfBracket(stepIndex, countStepsOfBracket(data)),
    });
  }

  /** The answer of a play another play or a stop took over: the step on air now. */
  private answerAfterAnotherMoveTookOver(): OGrafPlayActionReturnPayload {
    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    return { statusCode: 200, currentStep: this.currentStep };
  }

  /** Reads the lifecycle after an await, which stop or dispose may have changed meanwhile. */
  private readLifecycleNow(): LifecycleStage {
    return this.lifecycle;
  }

  private refuseUnlessLoaded(): OGrafReturnPayload | undefined {
    if (this.lifecycle === 'unloaded' || this.lifecycle === 'loading') {
      return buildRefusalAnswer(409, ptBR.actionProblems.notLoadedYet);
    }
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    return undefined;
  }

  private requireParts(): BracketParts {
    if (this.parts === undefined) {
      throw new Error('the parts are found only at load; a bug in bracket.ts');
    }
    return this.parts;
  }

  private requireData(): BracketData {
    if (this.data === undefined) {
      throw new Error('data is read only after load; a bug in bracket.ts');
    }
    return this.data;
  }

  private requireGeometry(): TreeGeometry {
    if (this.geometry === undefined) {
      throw new Error('the tree sizes are read at load; a bug in bracket.ts');
    }
    return this.geometry;
  }
}

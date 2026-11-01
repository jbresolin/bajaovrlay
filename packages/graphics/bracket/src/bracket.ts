/**
 * The bracket OGraf graphic: an elimination on the fullscreen layer, one step per
 * "Próximo" (catalogue entry 4). This file owns the OGraf lifecycle (load, play, update,
 * stop, dispose) and wires the rest: bracketModel (data), bracketStepView (what a step
 * shows, on the shared step plan the server counts with), bracketView (the DOM, drawn by
 * Lit from the data and the step), bracketPlayBookkeeping (what a play asks for, and the
 * count of moves that lets an overtaken one give up), bracketStepMoves (which pieces a step
 * brings in, lifts out or shows at once) on bracketAnimations (GSAP timelines from the
 * theme's motion tokens), the kit's wideBoardHead and motion timeline runner, and ptBR.
 *
 * The steps (stepCount -1 in the manifest, counted from the rounds) and what a play does
 * with them: bracketPlayBookkeeping.ts.
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
import { scrollingTextStyles } from '@bajaovrlay/graphics-kit/scrollingTextStyles';
import {
  createScrollingTextClock,
  type ScrollingTextClock,
} from '@bajaovrlay/graphics-kit/scrollingTextWhenTooLong';
import { teamWithSchoolStyles } from '@bajaovrlay/graphics-kit/teamWithSchoolStyles';
import { waitForImagesToSettle } from '@bajaovrlay/graphics-kit/waitForImagesToSettle';
import { wideBoardFrameStyles } from '@bajaovrlay/graphics-kit/wideBoardFrameStyles';
import { wideBoardHeadStyles } from '@bajaovrlay/graphics-kit/wideBoardHeadStyles';
import { waitForThemeFontsToBeReady } from '@bajaovrlay/theme/fonts';
import { LitElement } from 'lit';

import { placeHeadOffAir } from './bracketAnimations.js';
import { showWhatTheUpdateChanged, takeSnapshotOfTheStage } from './bracketLiveUpdates.js';
import {
  type BracketData,
  mergePartialUpdateIntoBracketData,
  parseCompleteBracketData,
} from './bracketModel.js';
import {
  answerAfterAnotherMoveTookOver,
  bringTheStepWithinTheData,
  buildRefusalAnswer,
  createMoveBookkeeping,
  type LifecycleStage,
  planThePlay,
  refuseASecondLoad,
  refuseUnlessLoaded,
} from './bracketPlayBookkeeping.js';
import {
  buildLiftOutOfThePieces,
  buildRiseOfTheStep,
  hideEveryPieceAtOnce,
  rememberPiecesOnScreen,
  showEveryPieceAtOnce,
  writeHeadOfTheStep,
} from './bracketStepMoves.js';
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

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** The bracket graphic; the default export a renderer registers as a custom element. */
export default class BracketGraphic extends LitElement implements OGrafGraphic {
  static override styles = [
    scrollingTextStyles,
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
  // gives the bracket up at its next await instead of drawing over the newer step. It also
  // marks Próximo's lift-out to a new view: an update meanwhile is only kept, like one
  // during the stop-out, and the play draws it once the old view is gone.
  private readonly moves = createMoveBookkeeping();
  /**
   * The one cycle of the texts too long for their box, every car on the stage and the event
   * line on it (BAJAOVRLAY-55). Made at load: the shadow root exists once Lit has rendered.
   */
  private scrollingTextClock: ScrollingTextClock | undefined = undefined;

  override render() {
    return renderBracketTemplate(this.onScreen);
  }

  /**
   * OGraf load: checks the data, reads the theme's sizes for the tree, draws step 0 with
   * everything hidden, waits for the theme's font and the head's logo (at most 2 s), and
   * leaves the bracket off air. Loaded once; a second load answers 409.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    const refusal = refuseASecondLoad(this.lifecycle);
    if (refusal !== undefined) {
      return refusal;
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
    this.scrollingTextClock = createScrollingTextClock({
      root: this.renderRoot,
      tokensSource: this,
    });
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
    const refusal = refuseUnlessLoaded(this.lifecycle);
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const plan = planThePlay({
      data: this.requireData(),
      currentStep: this.currentStep,
      isOnAir: this.lifecycle === 'onAir',
      goto: params.goto,
      delta: params.delta,
    });
    if (plan.kind === 'invalidStep') {
      return buildRefusalAnswer(400, ptBR.actionProblems.invalidPlayStep);
    }
    if (plan.kind === 'toTheEnd') {
      const stopAnswer = await this.stopAction({ skipAnimation });
      return { ...stopAnswer, currentStep: undefined };
    }
    if (plan.kind === 'alreadyOnIt') {
      return { statusCode: 200, currentStep: plan.step };
    }
    const moveNumberOfThisPlay = this.moves.startAMove();
    this.resultCrossfades.finishEveryTimelineAtOnce();
    this.lifecycle = 'onAir';
    this.currentStep = plan.targetStep;
    const parts = this.requireParts();

    if (plan.moveKind === 'newView') {
      // An update during the lift-out is only kept (updateAction), drawn below once the old
      // view is gone: drawn now, the next board would pop in over the leaving one.
      this.moves.startLiftOut(moveNumberOfThisPlay);
      await this.stepMotions.run(buildLiftOutOfThePieces(parts, false), skipAnimation);
      this.moves.endLiftOut(moveNumberOfThisPlay);
      if (this.moves.isOvertaken(moveNumberOfThisPlay)) {
        return answerAfterAnotherMoveTookOver(this.readLifecycleNow(), this.currentStep);
      }
    }
    // The data may have changed during the lift-out: the latest is drawn, at a step it has,
    // as the server brings its own step back (gate 2 of PR #30).
    const dataNow = this.requireData();
    const stepNow = bringTheStepWithinTheData(plan.targetStep, dataNow);
    this.currentStep = stepNow;
    const piecesBefore = rememberPiecesOnScreen(parts);
    await this.redrawAtStep(dataNow, stepNow);
    if (plan.moveKind === 'atOnce') {
      showEveryPieceAtOnce(parts);
      this.scrollingTextClock?.start();
      return { statusCode: 200, currentStep: stepNow };
    }
    await this.stepMotions.run(
      buildRiseOfTheStep(parts, plan.moveKind, piecesBefore),
      skipAnimation,
    );
    if (this.moves.isOvertaken(moveNumberOfThisPlay)) {
      return answerAfterAnotherMoveTookOver(this.readLifecycleNow(), this.currentStep);
    }
    // Started once the step has risen; on a later step it is already running, and the
    // texts the step redrew join its next cycle.
    this.scrollingTextClock?.start();
    // An update during the rise is drawn in place, and may have brought the step back.
    return { statusCode: 200, currentStep: this.currentStep };
  }

  /**
   * OGraf stopAction: the head and everything on the stage lift out together; resolves once
   * they are gone, with every piece hidden for the next take.
   */
  async stopAction(params: OGrafStopActionParams): Promise<OGrafReturnPayload> {
    const refusal = refuseUnlessLoaded(this.lifecycle);
    if (refusal !== undefined) {
      return refusal;
    }
    if (this.lifecycle === 'offAir') {
      return okAnswer;
    }
    const moveNumberOfThisStop = this.moves.startAMove();
    this.lifecycle = 'offAir';
    this.currentStep = undefined;
    this.scrollingTextClock?.holdTheTextsForThePlayOut();
    this.resultCrossfades.finishEveryTimelineAtOnce();
    const parts = this.requireParts();
    await this.stepMotions.run(buildLiftOutOfThePieces(parts, true), params.skipAnimation ?? false);
    this.scrollingTextClock?.stopAfterThePlayOut();

    // A play that came during the stop-out cut it short and owns the bracket now.
    if (this.moves.isOvertaken(moveNumberOfThisStop) || this.readLifecycleNow() !== 'offAir') {
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
    const refusal = refuseUnlessLoaded(this.lifecycle);
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoBracketData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.data = dataCheck.data;
    const isStoppingOut = this.lifecycle === 'offAir' && this.stepMotions.isRunning();
    if (isStoppingOut || this.moves.isLiftingOutForANewView()) {
      return okAnswer;
    }

    const parts = this.requireParts();
    if (this.lifecycle !== 'onAir') {
      await this.redrawAtStep(dataCheck.data, 0);
      hideEveryPieceAtOnce(parts);
      return okAnswer;
    }
    const stepOnAir = bringTheStepWithinTheData(this.currentStep ?? 0, dataCheck.data);
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
    this.scrollingTextClock?.stop();
    this.moves.overtakeEveryMove();
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
    this.scrollingTextClock?.stop();
    // A play pending on a motion ended here gives the bracket up rather than drawing on.
    this.moves.overtakeEveryMove();
    this.stepMotions.finishEveryTimelineAtOnce();
    this.resultCrossfades.finishEveryTimelineAtOnce();
  }

  /** Draws the data at a step, waits until Lit has drawn it, and writes the head. */
  private async redrawAtStep(data: BracketData, stepIndex: number): Promise<void> {
    this.onScreen = { data, stepIndex, geometry: this.requireGeometry() };
    this.requestUpdate();
    await this.updateComplete;
    this.parts ??= findBracketParts(this.renderRoot, this);
    writeHeadOfTheStep(this.requireParts(), data, stepIndex);
  }

  /** Reads the lifecycle after an await, which stop or dispose may have changed meanwhile. */
  private readLifecycleNow(): LifecycleStage {
    return this.lifecycle;
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

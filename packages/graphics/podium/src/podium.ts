/**
 * The podium OGraf graphic: the first three on one baseline, on the fullscreen layer,
 * revealed one place per step. This file owns the OGraf lifecycle (load, play, update,
 * stop, dispose) and wires the rest: podiumModel (data, cards, steps), podiumView (the DOM,
 * drawn by Lit from the data), the kit's wideBoardHead (the head card), podiumStepMoves (which
 * cards a step reveals, hides or lifts out) on podiumAnimations (GSAP timelines from the
 * theme's motion tokens), the kit's playSteps (the OGraf step rule),
 * timelinePlayback and waitForImagesToSettle, and ptBR.
 *
 * The steps (stepCount 4 in the manifest): play from off air goes to step 0, the head alone
 * (Entrar); each further play (Próximo) reveals one card, the 3rd at step 1, the 2nd at step
 * 2, the 1st at step 3, the others never moving; one more play is the end and takes the
 * podium off air. A `goto` straight to a later step brings those cards up together; a `goto`
 * back to an earlier step hides the cards past it at once, with no motion.
 *
 * The podium has no timer: nothing on it moves by itself. An update on air redraws the
 * cards in place; one that arrives during the stop-out is only kept, and drawn once the
 * cards are gone, so nothing changes on a fading card.
 *
 * The renderer, not this module, picks the tag name and calls customElements.define, as
 * OGraf v1 expects of a graphic's default export.
 */
import { carChipLargeStyles } from '@bajaovrlay/graphics-kit/carChipLargeStyles';
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
import { teamLogoCellStyles } from '@bajaovrlay/graphics-kit/teamLogoCellStyles';
import {
  finishTimelineAtOnce,
  playTimelineToTheEnd,
} from '@bajaovrlay/graphics-kit/timelinePlayback';
import { waitForImagesToSettle } from '@bajaovrlay/graphics-kit/waitForImagesToSettle';
import { wideBoardFrameStyles } from '@bajaovrlay/graphics-kit/wideBoardFrameStyles';
import { writeWideBoardHead } from '@bajaovrlay/graphics-kit/wideBoardHead';
import { wideBoardHeadStyles } from '@bajaovrlay/graphics-kit/wideBoardHeadStyles';
import { waitForThemeFontsToBeReady } from '@bajaovrlay/theme/fonts';
import { LitElement } from 'lit';

import { placeHeadOffAir, type PodiumTimeline } from './podiumAnimations.js';
import {
  mergePartialUpdateIntoPodiumData,
  parseCompletePodiumData,
  type PodiumData,
  podiumStepCount,
  readPodiumSettings,
  writeStepLine,
} from './podiumModel.js';
import {
  buildRevealTimeline,
  buildStopOutTimeline,
  hideCardsPastStep,
  hideEveryCardAtOnce,
  listFilledSlots,
  showOrHideRevealedSlotsThatChanged,
  stepBeforeTheStart,
} from './podiumStepMoves.js';
import { podiumStyles } from './podiumStyles.js';
import { findPodiumParts, type PodiumParts, renderPodiumTemplate } from './podiumView.js';
import { ptBR } from './ptBR.js';

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The podium graphic; the default export a renderer registers as a custom element. */
export default class PodiumGraphic extends LitElement implements OGrafGraphic {
  static override styles = [
    wideBoardFrameStyles,
    wideBoardHeadStyles,
    teamLogoCellStyles,
    carChipLargeStyles,
    podiumStyles,
  ];

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  // The latest data received; what is drawn may lag behind it during the stop-out.
  private data: PodiumData | undefined = undefined;
  // Read by render(); not a Lit reactive property, so the board is redrawn only when this
  // file asks (redrawWithData), never by surprise.
  private dataOnScreen: PodiumData | undefined = undefined;
  private parts: PodiumParts | undefined = undefined;
  // One motion at a time (in, a step, out); a new one finishes the running one first.
  private runningMotionTimeline: PodiumTimeline | undefined = undefined;

  override render() {
    return renderPodiumTemplate(this.dataOnScreen);
  }

  /**
   * OGraf load: checks the data, draws it with every card hidden, waits for the theme's
   * font and the logos (at most 2 s; a broken one never blocks), and leaves the podium off
   * air. Loaded once; a second load answers 409. Bad data leaves it unloaded.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompletePodiumData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';
    this.data = dataCheck.data;

    // Lit renders only connected elements: a load on an element not yet in the page
    // waits here until it is added.
    this.dataOnScreen = dataCheck.data;
    this.requestUpdate();
    await this.updateComplete;
    const parts = findPodiumParts(this.renderRoot, this);
    this.parts = parts;
    this.writeHeadNow();
    placeHeadOffAir(parts.tokensSource, parts.head);
    hideEveryCardAtOnce(parts);
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
   * OGraf playAction: from off air, brings the head in (step 0, or the cards up to a `goto`
   * step with it); on air, reveals the cards up to the next step. A step past the 1st
   * place means stop.
   */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: podiumStepCount,
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
    // A card still rising, or a stop-out still fading, ends now: the new step starts settled.
    this.finishRunningMotionAtOnce();
    this.lifecycle = 'onAir';
    this.currentStep = target.step;
    if (isEntering && this.dataOnScreen !== this.data) {
      // An update kept during a stop-out that a new play cut short.
      await this.redrawWithData(this.requireData());
    }
    this.writeHeadNow();
    const parts = this.requireParts();

    if (target.step < stepBefore) {
      hideCardsPastStep(parts, target.step, stepBefore);
      return { statusCode: 200, currentStep: target.step };
    }

    const riseIn = buildRevealTimeline(parts, { stepBefore, targetStep: target.step, isEntering });
    await this.runMotionTimeline(riseIn, skipAnimation);

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    // A stop during the rise took the podium off again: report the step actually on air.
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    return { statusCode: 200, currentStep: target.step };
  }

  /**
   * OGraf stopAction: the head and the revealed cards lift out together; resolves once they
   * are gone, with every card hidden and the head's step line cleared for the next take.
   */
  async stopAction(params: OGrafStopActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    if (this.lifecycle === 'offAir') {
      return okAnswer;
    }

    const stepOnAir = this.currentStep ?? 0;
    this.lifecycle = 'offAir';
    this.currentStep = undefined;
    const parts = this.requireParts();
    const stopOut = buildStopOutTimeline(parts, stepOnAir);
    await this.runMotionTimeline(stopOut, params.skipAnimation ?? false);

    // A play that came during the stop-out cut it short and owns the podium now.
    if (this.readLifecycleNow() !== 'offAir' || this.runningMotionTimeline !== undefined) {
      return okAnswer;
    }
    hideEveryCardAtOnce(parts);
    if (this.dataOnScreen !== this.data) {
      await this.redrawWithData(this.requireData());
    }
    this.writeHeadNow();
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load. The cards are
   * redrawn in place, with no motion: a revealed card shows its new texts; a revealed slot
   * that gains or loses its entry shows or hides at once. During the stop-out the data is
   * only kept, and drawn once the cards are gone.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoPodiumData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.data = dataCheck.data;
    const isStoppingOut = this.lifecycle === 'offAir' && this.runningMotionTimeline !== undefined;
    if (isStoppingOut) {
      return okAnswer;
    }

    const parts = this.requireParts();
    const slotsFilledBefore = listFilledSlots(parts);
    await this.redrawWithData(dataCheck.data);
    if (this.lifecycle === 'onAir') {
      showOrHideRevealedSlotsThatChanged(parts, this.currentStep ?? 0, slotsFilledBefore);
    }
    return okAnswer;
  }

  /** OGraf customAction: the podium has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /** OGraf dispose: ends the running timeline; pending actions resolve. */
  async dispose(): Promise<OGrafReturnPayload> {
    this.lifecycle = 'disposed';
    this.finishRunningMotionAtOnce();
    return okAnswer;
  }

  /**
   * Lit's hook for the element leaving the page: a running rise or lift is ended, so a
   * podium a renderer removed without dispose leaves nothing animating behind it.
   */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.finishRunningMotionAtOnce();
  }

  /** Keeps the data on screen, waits until Lit has drawn it, and writes the head. */
  private async redrawWithData(data: PodiumData): Promise<void> {
    this.dataOnScreen = data;
    this.requestUpdate();
    await this.updateComplete;
    this.writeHeadNow();
  }

  /** Writes the head from the data on screen and the step on air (no step line off air). */
  private writeHeadNow(): void {
    const settings = readPodiumSettings(this.requireDataOnScreen());
    writeWideBoardHead(this.requireParts(), {
      title: settings.title,
      eventLine: settings.eventLine,
      pageLine: writeStepLine(this.currentStep ?? 0),
    });
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

  private requireParts(): PodiumParts {
    if (this.parts === undefined) {
      throw new Error('the parts are found only at load; a bug in podium.ts');
    }
    return this.parts;
  }

  private requireData(): PodiumData {
    if (this.data === undefined) {
      throw new Error('data is read only after load; a bug in podium.ts');
    }
    return this.data;
  }

  private requireDataOnScreen(): PodiumData {
    if (this.dataOnScreen === undefined) {
      throw new Error('the data on screen is read only after load; a bug in podium.ts');
    }
    return this.dataOnScreen;
  }

  /** Ends the running motion at once, if any; its action then resolves. */
  private finishRunningMotionAtOnce(): void {
    const runningTimeline = this.runningMotionTimeline;
    this.runningMotionTimeline = undefined;
    if (runningTimeline !== undefined) {
      finishTimelineAtOnce(runningTimeline);
    }
  }

  /** Runs an in, step or out motion, kept so the next motion or dispose can end it early. */
  private async runMotionTimeline(timeline: PodiumTimeline, skipAnimation: boolean): Promise<void> {
    this.finishRunningMotionAtOnce();
    this.runningMotionTimeline = timeline;
    await playTimelineToTheEnd(timeline, { skipAnimation });
    if (this.runningMotionTimeline === timeline) {
      this.runningMotionTimeline = undefined;
    }
  }
}

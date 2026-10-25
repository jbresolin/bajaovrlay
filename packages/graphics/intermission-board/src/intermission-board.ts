/**
 * The intermission board OGraf graphic (BAJAOVRLAY-46): for a break, what is next with its
 * count, the overall top five and a sponsor line, each of the last two optional. This file
 * owns the OGraf lifecycle (load, play, update, stop, dispose) in the countdown's shape and
 * only wires the pieces together: intermissionBoardModel (data and parts),
 * intermissionBoardView (the DOM), intermissionBoardAnimations (GSAP from the theme's
 * tokens), intermissionSponsorLine (the line's pages and turn), and the kit's parts the
 * other graphics use: the countdown's countdownClock for the count, the sponsor roll's
 * paging rule and sponsorPageTurner for the line.
 *
 * From play on, the count ticks every frame until "0:00" and the line's timer holds each
 * page by its level; both stop on stop, dispose and removal from the page. An update (a
 * refreshed standings list, an edit in Cadastros, a start moved) redraws in place on air,
 * a part that came in placed on air at once, the count reading the new start; during a
 * motion it is drawn once the motion has ended; off air it is only stored and drawn.
 */
import { type CountdownClock, createCountdownClock } from '@bajaovrlay/graphics-kit/countdownClock';
import {
  createMotionTimelineRunner,
  type MotionTimelineRunner,
} from '@bajaovrlay/graphics-kit/motionTimelineRunner';
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
import type { PageTurner } from '@bajaovrlay/graphics-kit/pageTurner';
import { choosePlayActionTarget } from '@bajaovrlay/graphics-kit/playSteps';
import { createSponsorPageTurner } from '@bajaovrlay/graphics-kit/sponsorPageTurner';
import type { SponsorLevel } from '@bajaovrlay/graphics-kit/sponsorRound';
import { writeTextIfChanged } from '@bajaovrlay/graphics-kit/textInPlace';
import { waitForImagesToSettle } from '@bajaovrlay/graphics-kit/waitForImagesToSettle';
import { waitForThemeFontsToBeReady } from '@bajaovrlay/theme/fonts';
import { LitElement } from 'lit';

import {
  buildIntermissionBoardPlayInTimeline,
  buildIntermissionBoardStopOutTimeline,
  listIntermissionBoardPieces,
  placeIntermissionPiecesOffAir,
  placeIntermissionPiecesOnAir,
} from './intermissionBoardAnimations.js';
import {
  type IntermissionBoardData,
  listIntermissionBoardParts,
  mergePartialUpdateIntoIntermissionBoardData,
  parseCompleteIntermissionBoardData,
} from './intermissionBoardModel.js';
import { intermissionBoardStyles } from './intermissionBoardStyles.js';
import {
  findIntermissionBoardPieces,
  findIntermissionCount,
  renderIntermissionBoardTemplate,
} from './intermissionBoardView.js';
import { IntermissionSponsorLine } from './intermissionSponsorLine.js';
import { ptBR } from './ptBR.js';

/** Must match "stepCount" in intermission-board.ograf.json: play shows it, stop hides it. */
const intermissionBoardStepCount = 1;

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The intermission board graphic; the default export a renderer registers. */
export default class IntermissionBoardGraphic extends LitElement implements OGrafGraphic {
  static override styles = intermissionBoardStyles;

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  // Read by render(); not a Lit reactive property, so the board is redrawn only when this
  // file asks, never by surprise.
  private data: IntermissionBoardData | undefined = undefined;
  private isRedrawWaitingForTheMotion = false;
  private readonly motions: MotionTimelineRunner = createMotionTimelineRunner();
  private readonly sponsorLine = new IntermissionSponsorLine({
    readRenderRoot: () => this.renderRoot,
    readBoard: () => findIntermissionBoardPieces(this.renderRoot).board,
    readPages: () => listIntermissionBoardParts(this.requireData()).sponsorLinePages,
    redrawNow: () => this.redrawNow(),
    runMotion: (timeline) => this.motions.run(timeline, false),
  });
  private readonly countdownClock: CountdownClock = createCountdownClock({
    readStartsAtMs: () => this.data?.nextStartsAtMs,
    writeCountText: (countText) => this.writeCountText(countText),
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (frameId) => window.cancelAnimationFrame(frameId),
  });
  private readonly sponsorLineTimer: PageTurner = createSponsorPageTurner({
    tokensSource: this,
    readLevelOnAir: () => this.readLevelOfTheLineOnAir(),
    onTurn: () => this.turnTheSponsorLineNow(),
    setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimer: (timerId) => window.clearTimeout(timerId),
  });

  override render() {
    return renderIntermissionBoardTemplate(this.data, this.sponsorLine.readLayers());
  }

  /**
   * OGraf load: checks the data, draws it with the count as it is now and the line on its
   * first page, waits for the theme's font and the logos, and leaves the board off air.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompleteIntermissionBoardData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';

    await this.drawOffAir(dataCheck.data);
    await waitForThemeFontsToBeReady(this);
    await waitForImagesToSettle(this.renderRoot);

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    this.lifecycle = 'offAir';
    return okAnswer;
  }

  /** OGraf playAction: starts the count, animates the board in, starts the line's timer. */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: intermissionBoardStepCount,
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
    if (this.lifecycle === 'onAir') {
      return { statusCode: 200, currentStep: target.step };
    }

    this.lifecycle = 'onAir';
    this.currentStep = target.step;
    this.countdownClock.startTicking();
    const playIn = buildIntermissionBoardPlayInTimeline(
      findIntermissionBoardPieces(this.renderRoot),
    );
    await this.motions.run(playIn, skipAnimation);
    await this.drawTheWaitingUpdate();

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    this.startTheLineTimerWhenThereArePages();
    return { statusCode: 200, currentStep: target.step };
  }

  /** OGraf stopAction: stops the count and the line, animates everything out together. */
  async stopAction(params: OGrafStopActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    if (this.lifecycle === 'offAir') {
      return okAnswer;
    }

    this.lifecycle = 'offAir';
    this.currentStep = undefined;
    this.stopTheTimers();
    const stopOut = buildIntermissionBoardStopOutTimeline(
      findIntermissionBoardPieces(this.renderRoot),
    );
    await this.motions.run(stopOut, params.skipAnimation ?? false);
    if (this.readLifecycleNow() === 'offAir') {
      await this.drawOffAir(this.requireData());
    }
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load. On air the board is
   * redrawn in place (a part that came in, a top five or a sponsor line, placed on air at
   * once), the count reads the new start and ticks again, the line keeps its page (page 1
   * when it shrank under it); during a motion, once it has ended. Off air, only drawn.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoIntermissionBoardData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }

    if (this.lifecycle !== 'onAir') {
      await this.drawOffAir(dataCheck.data);
      return okAnswer;
    }
    this.data = dataCheck.data;
    if (this.motions.isRunning()) {
      this.isRedrawWaitingForTheMotion = true;
      return okAnswer;
    }
    await this.redrawOnAirInPlace();
    return okAnswer;
  }

  /** OGraf customAction: the board has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /**
   * Lit's hook for the element leaving the page: the count and the line's timer stop, so a
   * layer a renderer removed without dispose never goes on running. Not restarted if the
   * element comes back: a renderer loads a new element for a new layer.
   */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopTheTimers();
  }

  /** OGraf dispose: stops the count and the line's timer, ends every timeline. */
  async dispose(): Promise<OGrafReturnPayload> {
    this.lifecycle = 'disposed';
    this.stopTheTimers();
    this.motions.finishEveryTimelineAtOnce();
    return okAnswer;
  }

  /**
   * Turns the sponsor line to its next page now: what its timer calls after a hold. Nothing
   * happens off air, during another motion, or with a single page.
   */
  async turnTheSponsorLineNow(): Promise<void> {
    const canTurn =
      this.lifecycle === 'onAir' && !this.motions.isRunning() && this.sponsorLine.countPages() > 1;
    if (!canTurn) {
      return;
    }
    await this.sponsorLine.turnToTheNextPage();
    await this.drawTheWaitingUpdate();
  }

  /** Draws the data off air: every piece off air, the line on page 1, the count as now. */
  private async drawOffAir(data: IntermissionBoardData): Promise<void> {
    this.data = data;
    await this.sponsorLine.drawPageOne();
    const pieces = findIntermissionBoardPieces(this.renderRoot);
    placeIntermissionPiecesOffAir(pieces.board, listIntermissionBoardPieces(pieces));
    this.countdownClock.redraw();
  }

  /** Draws the data on air in place: every piece on air, the count and the line going on. */
  private async redrawOnAirInPlace(): Promise<void> {
    await this.sponsorLine.redrawThePageOnAirInPlace();
    placeIntermissionPiecesOnAir(
      listIntermissionBoardPieces(findIntermissionBoardPieces(this.renderRoot)),
    );
    this.countdownClock.redraw();
    this.countdownClock.startTicking();
    if (this.sponsorLine.countPages() <= 1) {
      this.sponsorLineTimer.stop();
      return;
    }
    this.startTheLineTimerWhenThereArePages();
  }

  /** After a motion: draws an update that came during it, if one did. */
  private async drawTheWaitingUpdate(): Promise<void> {
    if (!this.isRedrawWaitingForTheMotion || this.lifecycle !== 'onAir') {
      return;
    }
    this.isRedrawWaitingForTheMotion = false;
    await this.redrawOnAirInPlace();
  }

  /** The level of the line's page on air, whose hold its timer waits. */
  private readLevelOfTheLineOnAir(): SponsorLevel {
    const level = this.sponsorLine.readLevelOnAir();
    if (level === undefined) {
      throw new Error('the line timer runs only with pages; a bug in intermission-board.ts');
    }
    return level;
  }

  private startTheLineTimerWhenThereArePages(): void {
    if (this.lifecycle === 'onAir' && this.sponsorLine.countPages() > 1) {
      this.sponsorLineTimer.start();
    }
  }

  private stopTheTimers(): void {
    this.countdownClock.stopTicking();
    this.sponsorLineTimer.stop();
  }

  /** Writes the count where the board shows it, only when its text changed. */
  private writeCountText(countText: string): void {
    const countElement = findIntermissionCount(this.renderRoot);
    if (countElement !== undefined) {
      writeTextIfChanged(countElement, countText);
    }
  }

  /** Asks Lit to draw the board now, and waits until it has. */
  private async redrawNow(): Promise<void> {
    this.requestUpdate();
    await this.updateComplete;
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

  private requireData(): IntermissionBoardData {
    if (this.data === undefined) {
      throw new Error('intermission data is read only after load; a bug in intermission-board.ts');
    }
    return this.data;
  }
}

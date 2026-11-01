/**
 * The sponsor roll OGraf graphic (BAJAOVRLAY-46): every sponsor from Cadastros, a level a
 * page in tiles on the full screen (`fullscreen`), or one at a time in the bug's card in
 * the corner (`corner`), each page or sponsor held by its level's hold, the round in the
 * order every sponsor round goes ("Realização" last). This file owns the OGraf lifecycle
 * (load, play, update, stop, dispose) and only wires the pieces together: sponsorRollModel
 * (data and pages, on the kit's planSponsorPages), sponsorRollPageTurns (which page is on
 * air, and the turn to the next), sponsorRollView (the DOM), sponsorRollAnimations (GSAP
 * from the theme's tokens), the kit's sponsorPageTurner.
 *
 * The page timer runs only on air with more than one page, and stops on stop, dispose and
 * removal from the page. An update (an edit in Cadastros) redraws the page on air in place,
 * page 1 when the list shrank under it; during a motion (the play-in, a turn) it is stored
 * and drawn once the motion has ended; off air (also during the stop-out) it is only stored
 * and drawn, from page 1.
 */
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
import { scrollingTextStyles } from '@bajaovrlay/graphics-kit/scrollingTextStyles';
import {
  createScrollingTextClock,
  type ScrollingTextClock,
} from '@bajaovrlay/graphics-kit/scrollingTextWhenTooLong';
import { createSponsorPageTurner } from '@bajaovrlay/graphics-kit/sponsorPageTurner';
import type { SponsorLevel } from '@bajaovrlay/graphics-kit/sponsorRound';
import { waitForImagesToSettle } from '@bajaovrlay/graphics-kit/waitForImagesToSettle';
import { waitForThemeFontsToBeReady } from '@bajaovrlay/theme/fonts';
import { LitElement } from 'lit';

import { ptBR } from './ptBR.js';
import { buildSponsorRollStopOutTimeline } from './sponsorRollAnimations.js';
import {
  mergePartialUpdateIntoSponsorRollData,
  parseCompleteSponsorRollData,
  type SponsorRollData,
} from './sponsorRollModel.js';
import { SponsorRollPageTurns } from './sponsorRollPageTurns.js';
import { sponsorRollStyles } from './sponsorRollStyles.js';
import { findSponsorRollPanel, renderSponsorRollTemplate } from './sponsorRollView.js';

/** Must match "stepCount" in sponsor-roll.ograf.json: play shows the roll, stop hides it. */
const sponsorRollStepCount = 1;

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The sponsor roll graphic; the default export a renderer registers as a custom element. */
export default class SponsorRollGraphic extends LitElement implements OGrafGraphic {
  static override styles = [scrollingTextStyles, sponsorRollStyles];

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  // Read by render(); not Lit reactive properties, so the roll is redrawn only when this
  // file asks, never by surprise.
  private data: SponsorRollData | undefined = undefined;
  private isRedrawWaitingForTheMotion = false;
  private readonly motions: MotionTimelineRunner = createMotionTimelineRunner();
  /** The scroll cycle of the head's line and the corner's event word (BAJAOVRLAY-55), made at load. */
  private scrollingTextClock: ScrollingTextClock | undefined = undefined;
  private readonly pageTurns = new SponsorRollPageTurns({
    readRenderRoot: () => this.renderRoot,
    readData: () => this.requireData(),
    redrawNow: () => this.redrawNow(),
    runMotion: (timeline) => this.motions.run(timeline, false),
  });
  private readonly pageTurner: PageTurner = createSponsorPageTurner({
    tokensSource: this,
    readLevelOnAir: () => this.readLevelOnAir(),
    onTurn: () => this.turnToTheNextPageNow(),
    setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimer: (timerId) => window.clearTimeout(timerId),
  });

  override render() {
    return renderSponsorRollTemplate(this.data, this.pageTurns.readViewState());
  }

  /**
   * OGraf load: checks the data, draws page 1 off air, waits for the theme's font and the
   * page's logos (loaded or failed, at most 2 s). Loaded once; a second load answers 409.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompleteSponsorRollData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';

    this.data = dataCheck.data;
    await this.pageTurns.drawFromPageOneOffAir(dataCheck.data);
    this.scrollingTextClock = createScrollingTextClock({
      root: this.renderRoot,
      tokensSource: this,
    });
    await waitForThemeFontsToBeReady(this);
    await waitForImagesToSettle(this.renderRoot);

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    this.lifecycle = 'offAir';
    return okAnswer;
  }

  /** OGraf playAction: animates the roll in (step 0) and starts the page timer. */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: sponsorRollStepCount,
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
    await this.motions.run(this.pageTurns.buildPlayInTimeline(), skipAnimation);
    await this.drawTheWaitingUpdate();

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    this.startThePageTimerWhenThereArePages();
    this.scrollingTextClock?.start();
    return { statusCode: 200, currentStep: target.step };
  }

  /**
   * OGraf stopAction: stops the page timer, animates everything out together, and leaves
   * page 1 drawn off air for the next take.
   */
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
    this.pageTurner.stop();
    this.scrollingTextClock?.holdTheTextsForThePlayOut();
    const stopOut = buildSponsorRollStopOutTimeline(
      findSponsorRollPanel(this.renderRoot),
      this.pageTurns.listPiecesOnAir(),
    );
    await this.motions.run(stopOut, params.skipAnimation ?? false);
    this.scrollingTextClock?.stopAfterThePlayOut();
    if (this.readLifecycleNow() === 'offAir') {
      await this.pageTurns.drawFromPageOneOffAir(this.requireData());
    }
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load (the live refresh
   * sends every sponsor after an edit in Cadastros). On air, the page on air is drawn again
   * in place (page 1 when the list shrank under it) and the timer goes on, or stops with a
   * single page left; during a motion, once it has ended; off air, from page 1; during the
   * stop-out only stored, and drawn from page 1 once the roll has faded.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoSponsorRollData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }

    if (this.lifecycle !== 'onAir') {
      this.data = dataCheck.data;
      // During the stop-out the fading pieces are left alone: stopAction draws the data
      // stored here once they have faded.
      if (this.motions.isRunning()) {
        return okAnswer;
      }
      await this.pageTurns.drawFromPageOneOffAir(dataCheck.data);
      return okAnswer;
    }
    this.data = dataCheck.data;
    if (this.motions.isRunning()) {
      this.isRedrawWaitingForTheMotion = true;
      return okAnswer;
    }
    await this.redrawThePageOnAirInPlace();
    return okAnswer;
  }

  /** OGraf customAction: the roll has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /**
   * Lit's hook for the element leaving the page: the page timer stops, so a layer a
   * renderer removed without dispose never goes on turning. Not restarted if the element
   * comes back: a renderer loads a new element for a new layer.
   */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.pageTurner.stop();
    this.scrollingTextClock?.stop();
  }

  /** OGraf dispose: stops the page timer and ends every timeline; pending actions resolve. */
  async dispose(): Promise<OGrafReturnPayload> {
    this.lifecycle = 'disposed';
    this.pageTurner.stop();
    this.scrollingTextClock?.stop();
    this.motions.finishEveryTimelineAtOnce();
    return okAnswer;
  }

  /**
   * Turns to the next page (the next sponsor, in the corner) now: what the page timer calls
   * after a hold, and what the preview's "Atualizar" calls (not an OGraf action), which
   * then starts the hold again. Nothing happens off air, during another motion, or with a
   * single page. The head's words change in place; the tiles turn, or the cell crossfades.
   */
  async turnToTheNextPageNow(): Promise<void> {
    const pageCount = this.pageTurns.countPages();
    if (this.lifecycle !== 'onAir' || this.motions.isRunning() || pageCount <= 1) {
      return;
    }
    await this.pageTurns.turnToTheNextPage();
    await this.drawTheWaitingUpdate();
  }

  /**
   * Draws the page on air again in place with the data as it is now; the timer goes on with
   * the pages there are now, or stops with a single page left.
   */
  private async redrawThePageOnAirInPlace(): Promise<void> {
    await this.pageTurns.redrawThePageOnAirInPlace();
    if (this.pageTurns.countPages() <= 1) {
      this.pageTurner.stop();
      return;
    }
    this.startThePageTimerWhenThereArePages();
  }

  /** After a motion: draws an update that came during it, if one did. */
  private async drawTheWaitingUpdate(): Promise<void> {
    if (!this.isRedrawWaitingForTheMotion || this.lifecycle !== 'onAir') {
      return;
    }
    this.isRedrawWaitingForTheMotion = false;
    await this.redrawThePageOnAirInPlace();
  }

  /** Starts the page timer, only on air and with more than one page (a second start does nothing). */
  private startThePageTimerWhenThereArePages(): void {
    if (this.lifecycle === 'onAir' && this.pageTurns.countPages() > 1) {
      this.pageTurner.start();
    }
  }

  /** The level of the page on air, whose hold the timer waits. */
  private readLevelOnAir(): SponsorLevel {
    const page = this.pageTurns.readPageOnAir();
    if (page === undefined) {
      throw new Error('the timer runs only with pages; a bug in sponsor-roll.ts');
    }
    return page.level;
  }

  /** Asks Lit to draw what the page turns hold now, and waits until it has. */
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

  private requireData(): SponsorRollData {
    if (this.data === undefined) {
      throw new Error('sponsor roll data is read only after load; a bug in sponsor-roll.ts');
    }
    return this.data;
  }
}

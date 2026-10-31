/**
 * The sessions board OGraf graphic (BAJAOVRLAY-46): the day's schedule on a narrow board,
 * one pill per slot with its state ("CONCLUÍDA", "EM ANDAMENTO", "A SEGUIR"). This file owns
 * the OGraf lifecycle (load, play, update, stop, dispose) in the countdown's shape and only
 * wires the pieces together: sessionsBoardModel (data), sessionsBoardStatusChecks (the
 * slots on the board with their statuses, the re-check timer, the crossfade of a change, on
 * sessionsBoardWindow), sessionsBoardView (the DOM), sessionsBoardAnimations (GSAP from the
 * theme's tokens).
 *
 * A slot's status changes with the clock, and nothing refreshes the air when only time
 * passes, so the board works it out itself on the server-aligned clock and re-checks it on
 * a timer booked for the next start or end of any slot, never every frame. At the check the
 * changed rows crossfade. The timer is stopped on stop, dispose and removal from the page.
 * An update (an edit of the schedule) redraws the slots; on air the changed statuses
 * crossfade and the timer is booked again; off air the data is drawn; during the stop-out
 * it is only stored, and drawn once the board has faded.
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
import { choosePlayActionTarget } from '@bajaovrlay/graphics-kit/playSteps';
import { scrollingTextStyles } from '@bajaovrlay/graphics-kit/scrollingTextStyles';
import {
  createScrollingTextClock,
  type ScrollingTextClock,
} from '@bajaovrlay/graphics-kit/scrollingTextWhenTooLong';
import { waitForThemeFontsToBeReady } from '@bajaovrlay/theme/fonts';
import { LitElement } from 'lit';

import { ptBR } from './ptBR.js';
import {
  buildSessionsBoardPlayInTimeline,
  buildSessionsBoardStopOutTimeline,
  placeSessionsBoardPiecesOffAir,
} from './sessionsBoardAnimations.js';
import {
  mergePartialUpdateIntoSessionsBoardData,
  parseCompleteSessionsBoardData,
  type SessionsBoardData,
} from './sessionsBoardModel.js';
import { SessionsBoardStatusChecks } from './sessionsBoardStatusChecks.js';
import { sessionsBoardStyles } from './sessionsBoardStyles.js';
import {
  findSessionsBoard,
  findSessionsBoardHead,
  findSessionsBoardRows,
  renderSessionsBoardTemplate,
} from './sessionsBoardView.js';

/** Must match "stepCount" in sessions-board.ograf.json: play shows the board, stop hides it. */
const sessionsBoardStepCount = 1;

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The sessions board graphic; the default export a renderer registers as a custom element. */
export default class SessionsBoardGraphic extends LitElement implements OGrafGraphic {
  static override styles = [scrollingTextStyles, sessionsBoardStyles];

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  // Read by render(); not Lit reactive properties, so the board is redrawn only when this
  // file asks, never by surprise.
  private data: SessionsBoardData | undefined = undefined;
  // An update that came on air during a motion (the play-in, a crossfade), drawn after it.
  private isRedrawWaitingForTheMotion = false;
  private readonly motions: MotionTimelineRunner = createMotionTimelineRunner();
  /** The scroll cycle of the session names and the event line (BAJAOVRLAY-55), made at load. */
  private scrollingTextClock: ScrollingTextClock | undefined = undefined;
  private readonly statusChecks = new SessionsBoardStatusChecks({
    readRenderRoot: () => this.renderRoot,
    readData: () => this.requireData(),
    isOnAir: () => this.lifecycle === 'onAir',
    redrawNow: async () => {
      this.requestUpdate();
      await this.updateComplete;
    },
    runMotion: async (timeline) => {
      await this.motions.run(timeline, false);
      await this.drawTheWaitingUpdate();
    },
  });

  override render() {
    return renderSessionsBoardTemplate(this.data, this.statusChecks.readSlotsOnTheBoard());
  }

  /**
   * OGraf load: checks the data, draws the slots with their statuses now, waits for the
   * theme's font, and leaves the board off air. Loaded once; a second load answers 409.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompleteSessionsBoardData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';

    // Lit renders only connected elements: a load on an element not yet in the page waits
    // here until it is added.
    await this.storeAndDrawTheStatusesNow(dataCheck.data);
    this.scrollingTextClock = createScrollingTextClock({
      root: this.renderRoot,
      tokensSource: this,
    });
    this.placeEveryPieceOffAir();
    await waitForThemeFontsToBeReady(this);

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    this.lifecycle = 'offAir';
    return okAnswer;
  }

  /** OGraf playAction: animates the board in (step 0) and books the first status check. */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: sessionsBoardStepCount,
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
    // The statuses as they are at the take, drawn at once before the board rises.
    await this.storeAndDrawTheStatusesNow(this.requireData());
    this.placeEveryPieceOffAir();
    this.statusChecks.bookTheNextStatusCheck();
    const board = findSessionsBoard(this.renderRoot);
    const playIn = buildSessionsBoardPlayInTimeline(
      board,
      this.requireHead(),
      findSessionsBoardRows(this.renderRoot).map((rowParts) => rowParts.row),
    );
    await this.motions.run(playIn, skipAnimation);
    await this.drawTheWaitingUpdate();

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    this.scrollingTextClock?.start();
    return { statusCode: 200, currentStep: target.step };
  }

  /** OGraf stopAction: stops the status checks, animates the board out together. */
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
    this.statusChecks.cancelTheStatusCheck();
    this.scrollingTextClock?.stop();
    const stopOut = buildSessionsBoardStopOutTimeline(
      findSessionsBoard(this.renderRoot),
      this.listEveryPiece(),
    );
    await this.motions.run(stopOut, params.skipAnimation ?? false);
    // An update that came during the stop-out was only stored; drawn now, off air.
    if (this.readLifecycleNow() === 'offAir') {
      await this.storeAndDrawTheStatusesNow(this.requireData());
      this.placeEveryPieceOffAir();
    }
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load (the live refresh
   * sends every slot after an edit of the schedule). On air the slots are redrawn in place,
   * a row that came in is placed on air at once, the statuses that changed crossfade, and
   * the next check is booked again; during a motion on air (the play-in, a crossfade), once
   * it has ended; off air the data is drawn, every piece off air; during
   * the stop-out it is only stored, and drawn once the board has faded.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoSessionsBoardData(this.requireData(), params.data);
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
      await this.storeAndDrawTheStatusesNow(dataCheck.data);
      this.placeEveryPieceOffAir();
      return okAnswer;
    }
    this.data = dataCheck.data;
    if (this.motions.isRunning()) {
      this.isRedrawWaitingForTheMotion = true;
      return okAnswer;
    }
    await this.statusChecks.redrawOnAirAndCrossfadeTheChanges(dataCheck.data);
    this.statusChecks.bookTheNextStatusCheck();
    return okAnswer;
  }

  /** OGraf customAction: the board has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /**
   * Lit's hook for the element leaving the page: the status check is cancelled, so a layer
   * a renderer removed without dispose never goes on checking. Not restarted if the element
   * comes back: a renderer loads a new element for a new layer.
   */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.statusChecks.cancelTheStatusCheck();
    this.scrollingTextClock?.stop();
  }

  /** OGraf dispose: cancels the status check and ends every timeline; pending actions resolve. */
  async dispose(): Promise<OGrafReturnPayload> {
    this.lifecycle = 'disposed';
    this.statusChecks.cancelTheStatusCheck();
    this.scrollingTextClock?.stop();
    this.motions.finishEveryTimelineAtOnce();
    return okAnswer;
  }

  /**
   * Draws, once a motion has ended, the update that came on air during it: redrawn in place,
   * the changed statuses crossfading, the next check booked again. Nothing off air.
   */
  private async drawTheWaitingUpdate(): Promise<void> {
    if (!this.isRedrawWaitingForTheMotion || this.lifecycle !== 'onAir') {
      return;
    }
    this.isRedrawWaitingForTheMotion = false;
    await this.statusChecks.redrawOnAirAndCrossfadeTheChanges(this.requireData());
    this.statusChecks.bookTheNextStatusCheck();
  }

  /** Keeps the data and draws its slots with their statuses now, at once. */
  private async storeAndDrawTheStatusesNow(data: SessionsBoardData): Promise<void> {
    this.data = data;
    await this.statusChecks.drawTheStatusesNowAtOnce(data);
  }

  /** The head and every row: the pieces that come and go. */
  private listEveryPiece(): HTMLElement[] {
    const rows = findSessionsBoardRows(this.renderRoot).map((rowParts) => rowParts.row);
    return [this.requireHead(), ...rows];
  }

  private placeEveryPieceOffAir(): void {
    placeSessionsBoardPiecesOffAir(findSessionsBoard(this.renderRoot), this.listEveryPiece());
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

  private requireHead(): HTMLElement {
    const head = findSessionsBoardHead(this.renderRoot);
    if (head === undefined) {
      throw new Error('the head is read only after load; a bug in sessions-board.ts');
    }
    return head;
  }

  private requireData(): SessionsBoardData {
    if (this.data === undefined) {
      throw new Error('sessions board data is read only after load; a bug in sessions-board.ts');
    }
    return this.data;
  }
}

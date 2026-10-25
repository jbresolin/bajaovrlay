/**
 * The sessions board OGraf graphic (BAJAOVRLAY-46): the day's schedule on a narrow board,
 * one pill per slot with its state ("CONCLUÍDA", "EM ANDAMENTO", "A SEGUIR"). This file owns
 * the OGraf lifecycle (load, play, update, stop, dispose) in the countdown's shape and only
 * wires the pieces together: sessionsBoardModel (data), sessionsBoardWindow (each slot's
 * status by shared's findStatusOfScheduleSlot, the twelve-slot window, the next change),
 * sessionsBoardView (the DOM), sessionsBoardAnimations (GSAP from the theme's tokens).
 *
 * A slot's status changes with the clock, and nothing refreshes the air when only time
 * passes, so the board works it out itself on the server-aligned clock and re-checks it on
 * a timer booked for the next start or end of any slot, never every frame. At the check the
 * changed rows crossfade. The timer is stopped on stop, dispose and removal from the page.
 * An update (an edit of the schedule) redraws the slots; on air the changed statuses
 * crossfade and the timer is booked again; off air (also during the stop-out) the data is
 * only stored and drawn.
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
import { readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';
import type { ScheduleSlotStatus } from '@bajaovrlay/shared/scheduleSlotStatus';
import { waitForThemeFontsToBeReady } from '@bajaovrlay/theme/fonts';
import { LitElement } from 'lit';

import { ptBR } from './ptBR.js';
import {
  buildSessionsBoardPlayInTimeline,
  buildSessionsBoardStopOutTimeline,
  buildStatusCrossfadeTimeline,
  placeSessionsBoardPiecesOffAir,
  placeSessionsBoardPiecesOnAir,
  showStatusOfRowAtOnce,
  type SlotStatusChange,
} from './sessionsBoardAnimations.js';
import {
  mergePartialUpdateIntoSessionsBoardData,
  parseCompleteSessionsBoardData,
  type SessionsBoardData,
} from './sessionsBoardModel.js';
import { sessionsBoardStyles } from './sessionsBoardStyles.js';
import {
  findSessionsBoard,
  findSessionsBoardHead,
  findSessionsBoardRows,
  renderSessionsBoardTemplate,
} from './sessionsBoardView.js';
import {
  findNextStatusChangeAfter,
  listSlotsOnTheBoardAt,
  type SlotOnTheBoard,
} from './sessionsBoardWindow.js';

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
  static override styles = sessionsBoardStyles;

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  // Read by render(); not Lit reactive properties, so the board is redrawn only when this
  // file asks, never by surprise.
  private data: SessionsBoardData | undefined = undefined;
  private slotsOnTheBoard: SlotOnTheBoard[] = [];
  private readonly motions: MotionTimelineRunner = createMotionTimelineRunner();
  private pendingCheckTimerId: number | undefined = undefined;

  override render() {
    return renderSessionsBoardTemplate(this.data, this.slotsOnTheBoard);
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
    await this.redrawSlotsAt(dataCheck.data, readServerAlignedTimeMs());
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
    await this.redrawSlotsAt(this.requireData(), readServerAlignedTimeMs());
    this.placeEveryPieceOffAir();
    this.bookTheNextStatusCheck();
    const board = findSessionsBoard(this.renderRoot);
    const playIn = buildSessionsBoardPlayInTimeline(
      board,
      this.requireHead(),
      findSessionsBoardRows(this.renderRoot).map((rowParts) => rowParts.row),
    );
    await this.motions.run(playIn, skipAnimation);

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
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
    this.cancelTheStatusCheck();
    const stopOut = buildSessionsBoardStopOutTimeline(
      findSessionsBoard(this.renderRoot),
      this.listEveryPiece(),
    );
    await this.motions.run(stopOut, params.skipAnimation ?? false);
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load (the live refresh
   * sends every slot after an edit of the schedule). On air the slots are redrawn in place,
   * a row that came in is placed on air at once, the statuses that changed crossfade, and
   * the next check is booked again; off air (also during the stop-out) the data is only
   * stored and drawn.
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
      await this.redrawSlotsAt(dataCheck.data, readServerAlignedTimeMs());
      this.placeEveryPieceOffAir();
      return okAnswer;
    }
    await this.redrawOnAirAndCrossfadeTheChanges(dataCheck.data);
    this.bookTheNextStatusCheck();
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
    this.cancelTheStatusCheck();
  }

  /** OGraf dispose: cancels the status check and ends every timeline; pending actions resolve. */
  async dispose(): Promise<OGrafReturnPayload> {
    this.lifecycle = 'disposed';
    this.cancelTheStatusCheck();
    this.motions.finishEveryTimelineAtOnce();
    return okAnswer;
  }

  /**
   * The status check: at the next start or end, the statuses are worked out again, the
   * changed rows crossfade, and the following check is booked. What the timer calls; the
   * tests call it through fake time.
   */
  private async checkTheStatusesNow(): Promise<void> {
    this.pendingCheckTimerId = undefined;
    if (this.lifecycle !== 'onAir') {
      return;
    }
    await this.redrawOnAirAndCrossfadeTheChanges(this.requireData());
    this.bookTheNextStatusCheck();
  }

  /** Books the check for the next moment a status changes; none when nothing will change. */
  private bookTheNextStatusCheck(): void {
    this.cancelTheStatusCheck();
    if (this.lifecycle !== 'onAir') {
      return;
    }
    const nowMs = readServerAlignedTimeMs();
    const nextChangeMs = findNextStatusChangeAfter(this.requireData().slots, nowMs);
    if (nextChangeMs === undefined) {
      return;
    }
    this.pendingCheckTimerId = window.setTimeout(() => {
      void this.checkTheStatusesNow();
    }, nextChangeMs - nowMs);
  }

  private cancelTheStatusCheck(): void {
    if (this.pendingCheckTimerId === undefined) {
      return;
    }
    window.clearTimeout(this.pendingCheckTimerId);
    this.pendingCheckTimerId = undefined;
  }

  /**
   * Redraws the slots as they are now while on air: rows kept by slot id keep their look,
   * a row new on the board (an added slot, the window moving on) is placed on air at once,
   * and every slot whose status changed crossfades.
   */
  private async redrawOnAirAndCrossfadeTheChanges(data: SessionsBoardData): Promise<void> {
    const statusesBefore = new Map(
      this.slotsOnTheBoard.map((entry) => [entry.slot.slotId, entry.status]),
    );
    const rowsBefore = new Set(findSessionsBoardRows(this.renderRoot).map((parts) => parts.row));
    await this.redrawSlotsAt(data, readServerAlignedTimeMs(), statusesBefore);

    const changes: SlotStatusChange[] = [];
    for (const rowParts of findSessionsBoardRows(this.renderRoot)) {
      const statusAfter = this.readStatusOfSlot(rowParts.slotId);
      const statusBefore = statusesBefore.get(rowParts.slotId);
      if (!rowsBefore.has(rowParts.row) || statusBefore === undefined) {
        placeSessionsBoardPiecesOnAir([rowParts.row]);
        showStatusOfRowAtOnce(rowParts, statusAfter);
        continue;
      }
      if (statusBefore !== statusAfter) {
        changes.push({ rowParts, statusBefore, statusAfter });
      }
    }
    if (changes.length > 0) {
      const crossfade = buildStatusCrossfadeTimeline(findSessionsBoard(this.renderRoot), changes);
      await this.motions.run(crossfade, false);
    }
  }

  /**
   * Keeps the data and the slots on the board at `nowMs`, waits until Lit has drawn them,
   * and shows each row's status at once, except the rows given a status to keep (on air,
   * where the change crossfades instead).
   */
  private async redrawSlotsAt(
    data: SessionsBoardData,
    nowMs: number,
    statusesToKeep: Map<string, ScheduleSlotStatus> = new Map(),
  ): Promise<void> {
    this.data = data;
    this.slotsOnTheBoard = listSlotsOnTheBoardAt(data.slots, nowMs);
    this.requestUpdate();
    await this.updateComplete;
    for (const rowParts of findSessionsBoardRows(this.renderRoot)) {
      const statusKept = statusesToKeep.get(rowParts.slotId);
      showStatusOfRowAtOnce(rowParts, statusKept ?? this.readStatusOfSlot(rowParts.slotId));
    }
  }

  /** The status a slot on the board has now; a row with no slot is a bug in the view. */
  private readStatusOfSlot(slotId: string): ScheduleSlotStatus {
    const entry = this.slotsOnTheBoard.find((candidate) => candidate.slot.slotId === slotId);
    if (entry === undefined) {
      throw new Error(`a row of slot "${slotId}" has no slot on the board; a bug in the view`);
    }
    return entry.status;
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

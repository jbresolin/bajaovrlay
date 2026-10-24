/**
 * The lower strip OGraf graphic: the bar along the bottom with the clock block (the race
 * time and the flag pill), the running order six cars a page, and the page cell ("1/6"),
 * on the ticker layer. This file owns the OGraf lifecycle (load, play, update, stop,
 * dispose), the motion and the two timers, and wires the rest: lowerStripModel (data),
 * stripPages (which cars on which page), lowerStripPageTurns (the page and lane on air, a
 * turn and what arrived during it), lowerStripView (the DOM, pills reused by slot), and
 * from the graphics kit the clock block, barMotion, clockTicker, pageTurner,
 * stripPageHold, playSteps and timelinePlayback.
 *
 * A live update on air redraws the current page in place: the pills keep their slots,
 * nothing re-enters, and a car that moved to another page is simply on that page at the
 * next turn. An update during a page turn is drawn once the turn ends, and one during the
 * stop-out once the pills have faded out (on page 1, for the next take). The clock block
 * is redrawn every frame on air, with the server-aligned "now", as the race clock's card is.
 *
 * The renderer, not this module, picks the tag name and calls customElements.define, as
 * OGraf v1 expects of a graphic's default export.
 */
import {
  type BarTimeline,
  buildBarPlayInTimeline,
  buildBarStopOutTimeline,
  placeBarPiecesOffAir,
  placeBarPiecesOnAir,
} from '@bajaovrlay/graphics-kit/barMotion';
import { writeClockBlockAt } from '@bajaovrlay/graphics-kit/clockBlock';
import { type ClockTicker, createClockTicker } from '@bajaovrlay/graphics-kit/clockTicker';
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
import { createPageTurner, type PageTurner } from '@bajaovrlay/graphics-kit/pageTurner';
import { choosePlayActionTarget } from '@bajaovrlay/graphics-kit/playSteps';
import { readStripHoldMs } from '@bajaovrlay/graphics-kit/stripPageHold';
import {
  finishTimelineAtOnce,
  playTimelineToTheEnd,
} from '@bajaovrlay/graphics-kit/timelinePlayback';
import { readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';
import { waitForThemeFontsToBeReady } from '@bajaovrlay/theme/fonts';
import { LitElement } from 'lit';

import {
  isClockBlockShown,
  type LowerStripData,
  mergePartialUpdateIntoLowerStripData,
  parseCompleteLowerStripData,
  readClockReadingOfStrip,
} from './lowerStripModel.js';
import { LowerStripPageTurns } from './lowerStripPageTurns.js';
import { lowerStripStyles } from './lowerStripStyles.js';
import {
  findLowerStripParts,
  listPillsOfLane,
  type LowerStripParts,
  renderLowerStripTemplate,
  writeClockBlockSwitch,
} from './lowerStripView.js';
import { ptBR } from './ptBR.js';

/** Must match "stepCount" in lower-strip.ograf.json: play shows the strip, stop hides it. */
const lowerStripStepCount = 1;

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The lower strip graphic; the default export a renderer registers as a custom element. */
export default class LowerStripGraphic extends LitElement implements OGrafGraphic {
  static override styles = lowerStripStyles;

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  private data: LowerStripData | undefined = undefined;
  private parts: LowerStripParts | undefined = undefined;
  private runningMotionTimeline: BarTimeline | undefined = undefined;
  private readonly runningTimelines = new Set<BarTimeline>();
  private readonly pageTurner: PageTurner = createPageTurner({
    onTurn: () => this.turnToTheNextPageNow(),
    readHoldMs: () => readStripHoldMs(this),
    setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimer: (timerId) => window.clearTimeout(timerId),
  });
  private readonly clockTicker: ClockTicker = createClockTicker({
    onFrame: () => this.redrawClockBlock(),
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (frameId) => cancelAnimationFrame(frameId),
  });
  private readonly pageTurns = new LowerStripPageTurns({
    isOnAir: () => this.lifecycle === 'onAir',
    isOffAir: () => this.lifecycle === 'offAir',
    isMotionRunning: () => this.runningMotionTimeline !== undefined,
    readParts: () => this.requireParts(),
    readData: () => this.requireData(),
    runMotionTimeline: (timeline) => this.runMotionTimeline(timeline, false),
  });

  override render() {
    return renderLowerStripTemplate();
  }

  /**
   * OGraf load: checks the data, waits for the first render and the theme's font, draws
   * page 1 and the clock block off air. Loaded once; a second load answers 409. Bad data
   * leaves it unloaded, so load can be tried again.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompleteLowerStripData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';

    // What could go wrong: a renderer calling load on an element not yet in the page
    // waits here until it is added, because Lit renders only connected elements.
    await this.updateComplete;
    await waitForThemeFontsToBeReady(this);
    // A dispose that came while load was waiting must win.
    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }

    const parts = findLowerStripParts(this.renderRoot);
    this.parts = parts;
    this.data = dataCheck.data;
    writeClockBlockSwitch(parts, isClockBlockShown(dataCheck.data));
    this.redrawClockBlock();
    placeBarPiecesOffAir(parts.bar, [parts.clockBlock.block, parts.pageCell]);
    this.pageTurns.drawCurrentPage('offAir');
    this.lifecycle = 'offAir';
    return okAnswer;
  }

  /** OGraf playAction: animates the strip in (step 0); a step past it means stop. */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: lowerStripStepCount,
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
    this.redrawClockBlock();
    this.clockTicker.start();
    const parts = this.requireParts();
    const playIn = buildBarPlayInTimeline(parts.bar, this.listPiecesInOrder());
    await this.runMotionTimeline(playIn, skipAnimation);

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    // A stop during the play-in took the strip off again: report no step on air.
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    this.startPageTurnerWhenThereArePages();
    return { statusCode: 200, currentStep: target.step };
  }

  /**
   * OGraf stopAction: stops the page timer, animates every piece out together, resolves
   * once off screen, stops the clock's frame loop and leaves page 1 drawn off air.
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
    const parts = this.requireParts();
    // Both lanes: a turn the stop cut short may leave pills on either.
    const everyPiece = [
      parts.clockBlock.block,
      ...listPillsOfLane(parts.lanes[0]),
      ...listPillsOfLane(parts.lanes[1]),
      parts.pageCell,
    ];
    const stopOut = buildBarStopOutTimeline(parts.bar, everyPiece);
    await this.runMotionTimeline(stopOut, params.skipAnimation ?? false);
    // A play may have arrived during the out animation; only then keep the clock ticking.
    if (this.readLifecycleNow() !== 'onAir') {
      this.clockTicker.stop();
    }
    this.pageTurns.restOnPageOneOnceSettledOffAir();
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load (the live binding
   * sends a new running order every few seconds, the clock group a new reading). On air
   * the current page is redrawn in place and the clock block at once, with no re-entry;
   * off air they are simply drawn, ready for play. During a page turn or the stop-out the
   * cars are stored and drawn once that motion has ended.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoLowerStripData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }

    this.data = dataCheck.data;
    this.drawClockBlockSwitch();
    this.redrawClockBlock();
    this.pageTurns.drawUpdatedData();
    // A field taken on one page and grown past it must start turning; starting a running
    // timer does nothing.
    this.startPageTurnerWhenThereArePages();
    return okAnswer;
  }

  /**
   * Lit's hook for the element leaving the page: the page timer and the clock's frame loop
   * stop, so a layer a renderer removed without dispose never goes on turning pages or
   * drawing frames. Not restarted if the element comes back: a renderer loads a new
   * element for a new layer.
   */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.pageTurner.stop();
    this.clockTicker.stop();
  }

  /** OGraf customAction: the lower strip has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /**
   * OGraf dispose: stops the page timer and the frame loop and ends every timeline;
   * pending actions resolve.
   */
  async dispose(): Promise<OGrafReturnPayload> {
    this.lifecycle = 'disposed';
    this.pageTurner.stop();
    this.clockTicker.stop();
    for (const timeline of [...this.runningTimelines]) {
      finishTimelineAtOnce(timeline);
    }
    this.runningTimelines.clear();
    return okAnswer;
  }

  /**
   * Turns to the next page now: what the page timer calls after its hold, and what the
   * preview's "Próxima página" button and the tests call (not an OGraf action). Nothing
   * happens before load, off air (the strip rests on page 1 for the next take), during
   * another turn, or with a single page.
   */
  async turnToTheNextPageNow(): Promise<void> {
    if (this.lifecycle !== 'onAir') {
      return;
    }
    await this.pageTurns.turnToTheNextPage();
  }

  /** The pieces of the play-in, left to right: the clock block when shown, the cars, the page cell. */
  private listPiecesInOrder(): HTMLElement[] {
    const parts = this.requireParts();
    const clockBlockPieces = isClockBlockShown(this.requireData()) ? [parts.clockBlock.block] : [];
    return [...clockBlockPieces, ...this.pageTurns.listPillsOnAir(), parts.pageCell];
  }

  /**
   * Writes the clock block's switch. A block switched on while on air appears at once in
   * its place (a change on air is read, not watched); off air the next play brings it in.
   */
  private drawClockBlockSwitch(): void {
    const parts = this.requireParts();
    const isShown = isClockBlockShown(this.requireData());
    writeClockBlockSwitch(parts, isShown);
    if (isShown && this.lifecycle === 'onAir') {
      placeBarPiecesOnAir([parts.clockBlock.block]);
    }
  }

  /**
   * Writes the clock block as the reading is now, on every frame while on air. "Now" is
   * the shared server-aligned time, never Date.now(), as for the race clock's card, so the
   * two show the same time.
   */
  private redrawClockBlock(): void {
    if (this.data === undefined || this.parts === undefined) {
      return;
    }
    writeClockBlockAt(
      this.parts.clockBlock,
      readClockReadingOfStrip(this.data),
      readServerAlignedTimeMs(),
    );
  }

  /** Starts the page timer, only on air and with more than one page. */
  private startPageTurnerWhenThereArePages(): void {
    if (this.lifecycle === 'onAir' && this.pageTurns.countPages() > 1) {
      this.pageTurner.start();
    }
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

  private requireParts(): LowerStripParts {
    if (this.parts === undefined) {
      throw new Error('the parts are found only at load; a bug in lower-strip.ts');
    }
    return this.parts;
  }

  private requireData(): LowerStripData {
    if (this.data === undefined) {
      throw new Error('data is read only after load; a bug in lower-strip.ts');
    }
    return this.data;
  }

  /**
   * Runs an in, out or page motion; one still running is finished at once first, so a
   * stop during the play-in or a turn ends that motion and the stop-out starts settled.
   */
  private async runMotionTimeline(timeline: BarTimeline, skipAnimation: boolean): Promise<void> {
    if (this.runningMotionTimeline !== undefined) {
      finishTimelineAtOnce(this.runningMotionTimeline);
    }
    this.runningMotionTimeline = timeline;
    this.runningTimelines.add(timeline);
    await playTimelineToTheEnd(timeline, { skipAnimation });
    this.runningTimelines.delete(timeline);
    if (this.runningMotionTimeline === timeline) {
      this.runningMotionTimeline = undefined;
    }
  }
}

/**
 * The standings OGraf graphic: the overall table with the score's parts, paging by 20, or
 * the whole field in three columns of 20, on the fullscreen layer. This file owns the OGraf
 * lifecycle (load, play, update, stop, dispose) and the motion, and wires the rest:
 * standingsModel (data and defaults), standingsLayout (which board, which teams on which
 * page, the page line), standingsPageTurns (the page shown, a turn and what arrived during
 * it), standingsView (the DOM, rows reused by slot), standingsAnimations (GSAP timelines
 * from the theme's motion tokens), standingsPageHold (the hold between pages), ptBR, and
 * from the graphics kit pageTurner, playSteps and timelinePlayback.
 *
 * A live update on air draws the current page again in place: the rows keep their slots,
 * nothing re-enters, and a team that moved between pages simply appears on its new page
 * (re-ranking is not animated). An update during a page turn is drawn once the turn ends,
 * and one during the stop-out once the rows have faded out (on page 1, for the next take).
 *
 * The renderer, not this module, picks the tag name and calls customElements.define, as
 * OGraf v1 expects of a graphic's default export.
 */
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
import {
  finishTimelineAtOnce,
  playTimelineToTheEnd,
} from '@bajaovrlay/graphics-kit/timelinePlayback';
import { waitForThemeFontsToBeReady } from '@bajaovrlay/theme/fonts';
import { LitElement } from 'lit';

import { ptBR } from './ptBR.js';
import {
  buildLiftOutTogetherTimeline,
  buildPlayInTimeline,
  placePiecesOffAir,
  type StandingsTimeline,
} from './standingsAnimations.js';
import {
  mergePartialUpdateIntoStandingsData,
  parseCompleteStandingsData,
  type StandingsData,
} from './standingsModel.js';
import { readBoardHoldMs } from './standingsPageHold.js';
import { StandingsPageTurns } from './standingsPageTurns.js';
import { standingsStyles } from './standingsStyles.js';
import {
  findStandingsParts,
  listColumnCascades,
  renderStandingsTemplate,
  type StandingsParts,
} from './standingsView.js';

/** Must match "stepCount" in standings.ograf.json: play shows the board, stop hides it. */
const standingsStepCount = 1;

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The standings graphic; the default export a renderer registers as a custom element. */
export default class StandingsGraphic extends LitElement implements OGrafGraphic {
  static override styles = standingsStyles;

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  private data: StandingsData | undefined = undefined;
  private parts: StandingsParts | undefined = undefined;
  private runningMotionTimeline: StandingsTimeline | undefined = undefined;
  private readonly runningTimelines = new Set<StandingsTimeline>();
  private readonly pageTurner: PageTurner = createPageTurner({
    onTurn: () => this.turnToTheNextPageNow(),
    readHoldMs: () => readBoardHoldMs(this),
    setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimer: (timerId) => window.clearTimeout(timerId),
  });
  private readonly pageTurns = new StandingsPageTurns({
    isOnAir: () => this.lifecycle === 'onAir',
    isOffAir: () => this.lifecycle === 'offAir',
    isMotionRunning: () => this.runningMotionTimeline !== undefined,
    readParts: () => this.requireParts(),
    readData: () => this.requireData(),
    runMotionTimeline: (timeline) => this.runMotionTimeline(timeline, false),
  });

  override render() {
    return renderStandingsTemplate();
  }

  /**
   * OGraf load: checks the data, waits for the first render and the theme's font, draws
   * page 1 off air. Loaded once; a second load answers 409. Bad data leaves it unloaded.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompleteStandingsData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';

    // Lit renders only connected elements: a load on an element not yet in the page
    // waits here until it is added.
    await this.updateComplete;
    await waitForThemeFontsToBeReady(this);
    // A dispose that came while load was waiting must win.
    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }

    const parts = findStandingsParts(this.renderRoot, this);
    this.parts = parts;
    this.data = dataCheck.data;
    placePiecesOffAir(parts.tokensSource, [parts.head]);
    this.pageTurns.drawCurrentPage('offAir');
    this.lifecycle = 'offAir';
    return okAnswer;
  }

  /** OGraf playAction: animates the board in (step 0); a step past it means stop. */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: standingsStepCount,
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
    const parts = this.requireParts();
    const playIn = buildPlayInTimeline(parts.tokensSource, parts.head, listColumnCascades(parts));
    await this.runMotionTimeline(playIn, skipAnimation);

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    // A stop during the play-in took the board off again: report no step on air.
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    this.startPageTurnerWhenThereArePages();
    return { statusCode: 200, currentStep: target.step };
  }

  /**
   * OGraf stopAction: stops the page timer, animates everything out together, resolves
   * once off screen, and leaves page 1 drawn off air so the next take starts at the top.
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
    const everyPiece = [parts.head, ...listColumnCascades(parts).flat()];
    const stopOut = buildLiftOutTogetherTimeline(parts.tokensSource, everyPiece);
    await this.runMotionTimeline(stopOut, params.skipAnimation ?? false);
    this.pageTurns.restOnPageOneOnceSettledOffAir();
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load (the live binding
   * sends a new list every few seconds). On air the current page is drawn again in place,
   * with no re-entry; off air it is simply drawn, ready for play. During a page turn or
   * the stop-out the data is stored and drawn once that motion has ended.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoStandingsData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }

    this.data = dataCheck.data;
    this.pageTurns.drawUpdatedData();
    // A field taken on one page and grown past it must start turning; starting a running
    // timer does nothing.
    this.startPageTurnerWhenThereArePages();
    return okAnswer;
  }

  /** OGraf customAction: the standings have none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /** OGraf dispose: stops the page timer and ends every timeline; pending actions resolve. */
  async dispose(): Promise<OGrafReturnPayload> {
    this.lifecycle = 'disposed';
    this.pageTurner.stop();
    for (const timeline of [...this.runningTimelines]) {
      finishTimelineAtOnce(timeline);
    }
    this.runningTimelines.clear();
    return okAnswer;
  }

  /**
   * Turns to the next page now: what the page timer calls after its hold, and what the
   * preview's "Próxima página" button and the tests call (not an OGraf action). Nothing
   * happens before load, off air (the board rests on page 1 for the next take), during
   * another turn, or with a single page.
   */
  async turnToTheNextPageNow(): Promise<void> {
    if (this.lifecycle !== 'onAir') {
      return;
    }
    await this.pageTurns.turnToTheNextPage();
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

  private requireParts(): StandingsParts {
    if (this.parts === undefined) {
      throw new Error('the parts are found only at load; a bug in standings.ts');
    }
    return this.parts;
  }

  private requireData(): StandingsData {
    if (this.data === undefined) {
      throw new Error('data is read only after load; a bug in standings.ts');
    }
    return this.data;
  }

  /**
   * Runs an in, out or page motion; one still running is finished at once first, so a
   * stop during the play-in or a turn ends that motion and the stop-out starts settled.
   */
  private async runMotionTimeline(
    timeline: StandingsTimeline,
    skipAnimation: boolean,
  ): Promise<void> {
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

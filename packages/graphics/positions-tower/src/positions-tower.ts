/**
 * The positions tower OGraf graphic: the race order as slate pills, compact or detailed,
 * paging through the field and sliding the cars that change place. This file owns the
 * OGraf lifecycle (load, play, update, stop, dispose) and only wires the pieces
 * together; the rules live in named modules: positionsTowerModel (data and settings),
 * towerStage (the page on air and its rows, moved in place and never rebuilt, on top of
 * positionsTowerView and towerRows), towerPages (which cars are on which page),
 * pageTurner (the hold between pages), positionsTowerAnimations (GSAP timelines from the
 * theme's motion tokens), towerLayoutTokens (rows per page from the theme), playSteps
 * and themeFonts.
 *
 * The renderer, not this module, picks the tag name and calls customElements.define, as
 * OGraf v1 expects of a graphic's default export.
 */
import { readMotionTokens } from '@bajaovrlay/theme/motion';
import { LitElement } from 'lit';

import type {
  OGrafCustomActionParams,
  OGrafGraphic,
  OGrafLoadParams,
  OGrafPlayActionParams,
  OGrafPlayActionReturnPayload,
  OGrafReturnPayload,
  OGrafStopActionParams,
  OGrafUpdateActionParams,
} from './ografGraphicTypes.js';
import { createPageTurner, type PageTurner } from './pageTurner.js';
import { choosePlayActionTarget } from './playSteps.js';
import {
  finishTimelineAtOnce,
  playTimelineToTheEnd,
  type TowerTimeline,
} from './positionsTowerAnimations.js';
import {
  haveColumnsChanged,
  mergePartialUpdateIntoPositionsTowerData,
  parseCompletePositionsTowerData,
  type PositionsTowerData,
  readTowerSettings,
  type TowerSettings,
} from './positionsTowerModel.js';
import { positionsTowerStyles } from './positionsTowerStyles.js';
import {
  findPositionsTowerParts,
  renderPositionsTowerTemplate,
  type RowPlacement,
} from './positionsTowerView.js';
import { ptBR } from './ptBR.js';
import { waitForThemeFontsToBeReady } from './themeFonts.js';
import { readTowerLayoutTokens } from './towerLayoutTokens.js';
import { chooseNextPageInCycle } from './towerPages.js';
import { TowerStage } from './towerStage.js';

/** Must match "stepCount" in positions-tower.ograf.json: play shows the tower, stop hides it. */
const positionsTowerStepCount = 1;

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The positions tower graphic; the default export a renderer registers as a custom element. */
export default class PositionsTowerGraphic extends LitElement implements OGrafGraphic {
  static override styles = positionsTowerStyles;

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  private data: PositionsTowerData | undefined = undefined;
  private settings: TowerSettings | undefined = undefined;
  private stage: TowerStage | undefined = undefined;
  private isTurningPage = false;
  private readonly runningTimelines = new Set<TowerTimeline>();
  private readonly pageTurner: PageTurner = createPageTurner({
    onTurn: () => this.turnToTheNextPage(),
    readHoldMs: () => readMotionTokens(this).stripHoldMs,
    setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimer: (timerId) => window.clearTimeout(timerId),
  });

  override render() {
    return renderPositionsTowerTemplate();
  }

  /**
   * OGraf load: checks the data, waits for the first render and the theme's font, reads
   * the rows per page from the theme, draws page 1 off air. A graphic is loaded once; a
   * second load answers 409 rather than half resetting one that may be on air. Bad data
   * leaves it unloaded, so load can be tried again.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompletePositionsTowerData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';

    // What could go wrong: a renderer calling load on an element not yet in the page
    // waits here until it is added, because Lit renders only connected elements.
    await this.updateComplete;
    await waitForThemeFontsToBeReady();

    // A dispose that came while load was waiting must win; going on would bring a
    // disposed graphic back to life.
    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }

    const parts = findPositionsTowerParts(this.renderRoot, this);
    const stage = new TowerStage({
      parts,
      rowsPerPage: readTowerLayoutTokens(parts.tokensSource).rowsPerPage,
      runTimeline: (timeline, skipAnimation) => this.runTimeline(timeline, skipAnimation),
    });
    this.stage = stage;
    this.data = dataCheck.data;
    this.settings = readTowerSettings(dataCheck.data);
    stage.applyColumns(this.settings);
    stage.placeHeadOffAir();
    stage.placeCurrentPage(dataCheck.data.entries, 'offAir');
    this.lifecycle = 'offAir';
    return okAnswer;
  }

  /** OGraf playAction: animates the tower in (step 0); a step past it means stop. */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: positionsTowerStepCount,
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
    await this.requireStage().playIn(skipAnimation);

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    // A stop during the play-in took the tower off again: report the step actually on
    // air (none), so a renderer tracking steps from this answer stays in step.
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    this.startPageTurnerWhenCycling();
    return { statusCode: 200, currentStep: target.step };
  }

  /** OGraf stopAction: stops the page timer, animates the tower out, resolves once off screen. */
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
    await this.requireStage().playOut(params.skipAnimation ?? false);
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load, on air or off
   * (the live binding sends a new list about every 2 s; the operator may change the
   * layout, the columns or the paging). On air the rows whose slot changed slide, cars
   * entering the page rise in and cars leaving lift out; a column change rebuilds the
   * cells of the same rows in place; off air everything is simply drawn, ready for play.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const settingsBefore = this.requireSettings();
    const dataCheck = mergePartialUpdateIntoPositionsTowerData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }

    this.data = dataCheck.data;
    const settingsAfter = readTowerSettings(dataCheck.data);
    this.settings = settingsAfter;
    const stage = this.requireStage();
    if (haveColumnsChanged(settingsBefore, settingsAfter)) {
      stage.applyColumns(settingsAfter);
    }

    const skipAnimation = params.skipAnimation ?? false;
    // During a page turn the rows on air are on their way out or in; the turn's second
    // half draws the new page from the data just stored, so nothing else is moved here.
    if (!this.isTurningPage) {
      const placement = this.chooseRowPlacement(skipAnimation);
      if (placement === 'animated') {
        await stage.applyEntriesWithMotion(dataCheck.data.entries);
      } else {
        stage.placeCurrentPage(dataCheck.data.entries, placement);
      }
    }

    const hasPagingChanged = settingsBefore.paging !== settingsAfter.paging;
    if (hasPagingChanged && this.readLifecycleNow() !== 'disposed') {
      await this.applyPagingChange(skipAnimation);
    }
    return okAnswer;
  }

  /** OGraf customAction: the tower has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /**
   * OGraf dispose: stops the page timer and ends every timeline; pending actions resolve.
   * OGraf passes an empty params object, which the tower has no use for.
   */
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
   * Turns to the next page now, as the page timer does after its hold. Not an OGraf
   * action: the preview page's "Próxima página" button and the tests call it. Refused
   * silently before load; with one page there is nothing to turn.
   */
  async turnToTheNextPageNow(): Promise<void> {
    if (this.refuseUnlessLoaded() !== undefined) {
      return;
    }
    await this.turnToTheNextPage();
  }

  /**
   * Reads the lifecycle after an await. Another call (stop, dispose) may have changed it
   * while the animation ran; reading through a method stops TypeScript from assuming
   * it is still the value it had before the await.
   */
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

  private requireStage(): TowerStage {
    if (this.stage === undefined) {
      throw new Error('the stage exists only after load; a bug in positions-tower.ts');
    }
    return this.stage;
  }

  private requireData(): PositionsTowerData {
    if (this.data === undefined) {
      throw new Error('data is read only after load; a bug in positions-tower.ts');
    }
    return this.data;
  }

  private requireSettings(): TowerSettings {
    if (this.settings === undefined) {
      throw new Error('settings are read only after load; a bug in positions-tower.ts');
    }
    return this.settings;
  }

  /** How rows are placed for the lifecycle now: drawn off air, shown at once, or animated. */
  private chooseRowPlacement(skipAnimation: boolean): RowPlacement {
    if (this.lifecycle !== 'onAir') {
      return 'offAir';
    }
    return skipAnimation ? 'atOnce' : 'animated';
  }

  /** Holds page 1 when paging turned to firstPageOnly; starts cycling when it turned to cycle. */
  private async applyPagingChange(skipAnimation: boolean): Promise<void> {
    const paging = this.requireSettings().paging;
    if (paging === 'firstPageOnly') {
      this.pageTurner.stop();
      if (this.requireStage().readCurrentPage() !== 1) {
        await this.turnToPage(1, skipAnimation);
      }
      return;
    }
    this.startPageTurnerWhenCycling();
  }

  /** Starts the page timer, only on air with pages cycling and more than one page. */
  private startPageTurnerWhenCycling(): void {
    const pageCount = this.requireStage().countPages(this.requireData().entries.length);
    const isCycling = this.requireSettings().paging === 'cycle';
    if (this.lifecycle === 'onAir' && isCycling && pageCount > 1) {
      this.pageTurner.start();
    }
  }

  /** The page after this one in the cycle; nothing to do with a single page. */
  private async turnToTheNextPage(): Promise<void> {
    const stage = this.requireStage();
    const pageCount = stage.countPages(this.requireData().entries.length);
    if (pageCount === 1) {
      return;
    }
    await this.turnToPage(chooseNextPageInCycle(stage.readCurrentPage(), pageCount), false);
  }

  /**
   * Turns the page: on air the rows leave together, then the new page's rows rise in
   * cascade while the head stays; off air the new page is simply drawn. Only one turn at
   * a time: a second ask while one is in progress is dropped.
   */
  private async turnToPage(pageNumber: number, skipAnimation: boolean): Promise<void> {
    if (this.isTurningPage) {
      return;
    }
    this.isTurningPage = true;
    const stage = this.requireStage();
    const isAnimated = this.lifecycle === 'onAir' && !skipAnimation;

    if (isAnimated) {
      await stage.liftRowsOut();
    }
    if (this.readLifecycleNow() === 'disposed') {
      this.isTurningPage = false;
      return;
    }

    const isOnAirAtOnce = this.readLifecycleNow() === 'onAir' && skipAnimation;
    stage.showPage(this.requireData().entries, pageNumber, isOnAirAtOnce ? 'atOnce' : 'offAir');
    if (isAnimated && this.readLifecycleNow() === 'onAir') {
      await stage.riseRowsIn();
    }
    this.isTurningPage = false;
  }

  /** Plays a timeline to its end, keeping track of it so dispose can end it early. */
  private async runTimeline(timeline: TowerTimeline, skipAnimation: boolean): Promise<void> {
    this.runningTimelines.add(timeline);
    await playTimelineToTheEnd(timeline, { skipAnimation });
    this.runningTimelines.delete(timeline);
  }
}

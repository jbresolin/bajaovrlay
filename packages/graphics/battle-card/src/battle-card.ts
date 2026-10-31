/**
 * The battle card OGraf graphic: two cars fighting for one place, bottom-centre on the
 * lower-third layer, with the gap between them and its trend. This file owns the OGraf
 * lifecycle (load, play, update, stop, dispose) in the team card's shape and wires the
 * pieces together; the rules live in named modules: battleCardModel (data and texts),
 * battleTrend (the trend remembered from lap to lap), battleCardView (the DOM, drawn by Lit
 * from what is on screen), playSteps (the OGraf step rule), battleCardAnimations (GSAP
 * timelines from the theme's motion tokens) and battleTrendCrossfade (the trend cell's
 * crossfade on air, kept so it can be ended at once).
 *
 * Every update is a reading the trend follows (battleTrend.ts), on air or off. On air the
 * gap and the laps change in place; the trend cell crossfades only when its word changes,
 * otherwise only its number changes in place. An update during the stop-out only stores
 * the data (and the reading); the card is drawn with it once it is off screen, ready for
 * the next play. The crossfade is the card's one motion that runs on its own, so stop,
 * dispose and the element leaving the page each end it at once.
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
import { choosePlayActionTarget } from '@bajaovrlay/graphics-kit/playSteps';
import { scrollingTextStyles } from '@bajaovrlay/graphics-kit/scrollingTextStyles';
import {
  createScrollingTextClock,
  type ScrollingTextClock,
} from '@bajaovrlay/graphics-kit/scrollingTextWhenTooLong';
import {
  finishTimelineAtOnce,
  playTimelineToTheEnd,
} from '@bajaovrlay/graphics-kit/timelinePlayback';
import { waitForThemeFontsToBeReady } from '@bajaovrlay/theme/fonts';
import { LitElement } from 'lit';

import {
  type BattleCardTimeline,
  buildPlayInTimeline,
  buildStopOutTimeline,
  placePiecesOffAir,
  placeTrendLayersAtRest,
} from './battleCardAnimations.js';
import {
  type BattleCardData,
  mergePartialUpdateIntoBattleCardData,
  parseCompleteBattleCardData,
  readCarAhead,
  readCarBehind,
  readGapReading,
  writeGapCellText,
} from './battleCardModel.js';
import { battleCardStyles } from './battleCardStyles.js';
import {
  type BattleCardParts,
  findBattleCardParts,
  renderBattleCardTemplate,
} from './battleCardView.js';
import {
  chooseTrendToShow,
  emptyTrendMemory,
  followGapReading,
  isGapOfTheseTwoCars,
  type TrendMemory,
  type TrendShown,
} from './battleTrend.js';
import { BattleTrendCrossfade } from './battleTrendCrossfade.js';
import { ptBR } from './ptBR.js';

/** Must match "stepCount" in battle-card.ograf.json: play shows the card, stop hides it. */
const battleCardStepCount = 1;

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The battle card graphic; the default export a renderer registers as a custom element. */
export default class BattleCardGraphic extends LitElement implements OGrafGraphic {
  static override styles = [scrollingTextStyles, battleCardStyles];

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  // The latest data, and the data drawn on screen, which render() reads: an update during
  // the stop-out changes only the first, so no redraw can reach the card fading out (gate
  // 2 of PR #27). Not Lit reactive properties: the card is redrawn only when asked.
  private data: BattleCardData | undefined = undefined;
  private dataOnScreen: BattleCardData | undefined = undefined;
  private trendOnScreen: TrendShown | undefined = undefined;
  private incomingTrend: TrendShown | undefined = undefined;
  private trendMemory: TrendMemory = emptyTrendMemory;
  private parts: BattleCardParts | undefined = undefined;
  // The card has one in or out at a time, so one timeline is all there is to end.
  private runningPiecesTimeline: BattleCardTimeline | undefined = undefined;
  private isStoppingOut = false;
  /** The long names' scrolling cycle (BAJAOVRLAY-55); made at load, once Lit has rendered. */
  private scrollingTextClock: ScrollingTextClock | undefined = undefined;
  private readonly trendCrossfade = new BattleTrendCrossfade((trend) => {
    this.putTrendAtRest(trend);
  });

  override render() {
    const data = this.dataOnScreen;
    const trendOnScreen = this.trendOnScreen;
    if (data === undefined || trendOnScreen === undefined) {
      return renderBattleCardTemplate(undefined);
    }
    return renderBattleCardTemplate({
      carAhead: readCarAhead(data),
      carBehind: readCarBehind(data),
      gapText: writeGapCellText(data),
      trendOnScreen,
      incomingTrend: this.incomingTrend ?? trendOnScreen,
    });
  }

  /**
   * OGraf load: checks the data, takes it as the trend's first reading, draws it, waits
   * for the theme's font and leaves the card off air. Loaded once; a second load answers
   * 409. Bad data leaves it unloaded, so load can be tried again.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompleteBattleCardData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';

    this.storeDataAndFollowTheTrend(dataCheck.data);
    // What could go wrong: a load on an element not yet in the page waits here until it
    // is added, because Lit renders only connected elements.
    await this.redrawAtRest();
    const parts = findBattleCardParts(this.renderRoot);
    this.parts = parts;
    this.scrollingTextClock = createScrollingTextClock({
      root: this.renderRoot,
      tokensSource: this,
    });
    placePiecesOffAir(parts);
    await waitForThemeFontsToBeReady(this);

    // A dispose that came while load was waiting must win.
    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    this.lifecycle = 'offAir';
    return okAnswer;
  }

  /** OGraf playAction: brings the card in (step 0); a step past it means stop. */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: battleCardStepCount,
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
    // A play that cut a stop-out short comes in with the data stored meanwhile.
    if (this.dataOnScreen !== this.data) {
      await this.redrawAtRest();
    }
    await this.runPiecesTimeline(buildPlayInTimeline(this.requireParts()), skipAnimation);

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    // A stop during the play-in took the card off again: report the step on air (none).
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    this.scrollingTextClock?.start();
    return { statusCode: 200, currentStep: target.step };
  }

  /**
   * OGraf stopAction: ends a running trend crossfade, lifts the three pieces out, and once
   * they are off screen draws the latest data at rest, ready for the next play.
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
    this.scrollingTextClock?.stop();
    this.trendCrossfade.finish();
    this.isStoppingOut = true;
    await this.runPiecesTimeline(
      buildStopOutTimeline(this.requireParts()),
      params.skipAnimation ?? false,
    );
    this.isStoppingOut = false;
    if (this.readLifecycleNow() === 'offAir') {
      await this.redrawAtRest();
    }
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load and takes it as a
   * reading of the trend. On air the texts change in place and a new trend word
   * crossfades in; off air the card is drawn at once; during the stop-out the data is only
   * stored. Refused only before load and after dispose.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoBattleCardData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }

    this.storeDataAndFollowTheTrend(dataCheck.data);
    if (this.isStoppingOut) {
      return okAnswer;
    }
    if (this.lifecycle !== 'onAir') {
      await this.redrawAtRest();
      return okAnswer;
    }
    await this.showTrendWantedOnAir(params.skipAnimation ?? false);
    return okAnswer;
  }

  /** OGraf customAction: the battle card has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /** OGraf dispose: ends every timeline, the crossfade included; pending actions resolve. */
  async dispose(): Promise<OGrafReturnPayload> {
    this.lifecycle = 'disposed';
    this.scrollingTextClock?.stop();
    this.trendCrossfade.finish();
    this.finishRunningPiecesTimelineAtOnce();
    return okAnswer;
  }

  /**
   * Lit's hook for the element leaving the page: a running crossfade and a running in or
   * out are ended, so a card a renderer removed without dispose leaves nothing animating.
   */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.scrollingTextClock?.stop();
    this.trendCrossfade.finish();
    this.finishRunningPiecesTimelineAtOnce();
  }

  /** Ends the running in or out at once, if any; its action then resolves. */
  private finishRunningPiecesTimelineAtOnce(): void {
    const runningTimeline = this.runningPiecesTimeline;
    this.runningPiecesTimeline = undefined;
    if (runningTimeline !== undefined) {
      finishTimelineAtOnce(runningTimeline);
    }
  }

  /** Keeps the data and lets the trend's memory follow it as one more reading. */
  private storeDataAndFollowTheTrend(data: BattleCardData): void {
    this.data = data;
    this.trendMemory = followGapReading(this.trendMemory, readGapReading(data));
  }

  /** The trend the data asks for now: set by hand, or the one from the gap. */
  private chooseTrendWanted(): TrendShown {
    const data = this.requireData();
    return chooseTrendToShow(this.trendMemory, data, isGapOfTheseTwoCars(readGapReading(data)));
  }

  /** Draws the data with the trend wanted on both layers, and waits until Lit has drawn it. */
  private async redrawAtRest(): Promise<void> {
    this.dataOnScreen = this.data;
    const trendWanted = this.chooseTrendWanted();
    this.trendOnScreen = trendWanted;
    this.incomingTrend = trendWanted;
    this.requestUpdate();
    await this.updateComplete;
  }

  /**
   * On air: the same word as on screen changes only the texts (the number in place); a
   * new word is dressed on the incoming layer and crossfaded in over the current one.
   */
  private async showTrendWantedOnAir(skipAnimation: boolean): Promise<void> {
    this.trendCrossfade.finish();
    const trendWanted = this.chooseTrendWanted();
    if (this.trendOnScreen?.word === trendWanted.word) {
      await this.redrawAtRest();
      return;
    }

    this.dataOnScreen = this.data;
    this.incomingTrend = trendWanted;
    this.requestUpdate();
    await this.updateComplete;
    await this.trendCrossfade.run(this.requireParts(), trendWanted, skipAnimation);
  }

  /**
   * Dresses the current layer in the trend and puts both layers back at rest, at once
   * (Lit draws the new words before the next frame).
   */
  private putTrendAtRest(trend: TrendShown): void {
    this.trendOnScreen = trend;
    this.incomingTrend = trend;
    this.requestUpdate();
    placeTrendLayersAtRest(this.requireParts());
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

  private requireParts(): BattleCardParts {
    if (this.parts === undefined) {
      throw new Error('the battle card parts are found only at load; a bug in battle-card.ts');
    }
    return this.parts;
  }

  private requireData(): BattleCardData {
    if (this.data === undefined) {
      throw new Error('battle card data is read only after load; a bug in battle-card.ts');
    }
    return this.data;
  }

  /**
   * Runs an in or out animation, kept so dispose can end it early; one still running is
   * finished at once first, so an out that comes during the in never tangles with it.
   */
  private async runPiecesTimeline(
    timeline: BattleCardTimeline,
    skipAnimation: boolean,
  ): Promise<void> {
    if (this.runningPiecesTimeline !== undefined) {
      finishTimelineAtOnce(this.runningPiecesTimeline);
    }
    this.runningPiecesTimeline = timeline;
    await playTimelineToTheEnd(timeline, { skipAnimation });
    if (this.runningPiecesTimeline === timeline) {
      this.runningPiecesTimeline = undefined;
    }
  }
}

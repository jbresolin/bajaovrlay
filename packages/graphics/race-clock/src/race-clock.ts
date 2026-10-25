/**
 * The race clock OGraf graphic: the logo and session title, running race time, leader
 * laps and the optional flag band. This file owns the OGraf lifecycle (load, play,
 * update, stop, dispose) and only wires the pieces together; the rules live in named
 * modules: raceClockModel (data), raceClockView (the DOM, changed in place, never
 * rebuilt), playSteps (the OGraf step rule), the kit's clockTicker (the frame loop) and
 * raceClockAnimations (GSAP timelines from the theme's motion tokens). The wait for the
 * theme's face before the first draw is the theme's own (`@bajaovrlay/theme/fonts`).
 *
 * The renderer, not this module, picks the tag name and calls customElements.define, as
 * OGraf v1 expects of a graphic's default export.
 */
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
import { choosePlayActionTarget } from '@bajaovrlay/graphics-kit/playSteps';
import type { FlagState } from '@bajaovrlay/graphics-kit/raceClockReading';
import {
  finishTimelineAtOnce,
  playTimelineToTheEnd,
} from '@bajaovrlay/graphics-kit/timelinePlayback';
import { readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';
import { waitForThemeFontsToBeReady } from '@bajaovrlay/theme/fonts';
import { LitElement } from 'lit';

import { ptBR } from './ptBR.js';
import {
  buildFlagBandToggleTimeline,
  buildFlagChangeTimeline,
  buildPlayInTimeline,
  buildStopOutTimeline,
  placePanelOffAir,
  type RaceClockTimeline,
} from './raceClockAnimations.js';
import {
  isFlagBandShown,
  mergePartialUpdateIntoRaceClockData,
  parseCompleteRaceClockData,
  type RaceClockData,
} from './raceClockModel.js';
import { raceClockStyles } from './raceClockStyles.js';
import {
  findRaceClockParts,
  prepareIncomingFlagLayer,
  type RaceClockParts,
  renderRaceClockTemplate,
  showFlagBandAtOnce,
  showFlagBandAtOnceAndMeasureChange,
  showFlagStateAtOnce,
  writeClockTimeAt,
  writeSessionCaptionAndLaps,
} from './raceClockView.js';

/** Must match "stepCount" in race-clock.ograf.json: play shows the clock, stop hides it. */
const raceClockStepCount = 1;

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

/** A flag change on air (crossfade or band toggle) and what draws its end state at once. */
type RunningFlagChange = { timeline: RaceClockTimeline; settleAtOnce: () => void };

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The race clock graphic; the default export a renderer registers as a custom element. */
export default class RaceClockGraphic extends LitElement implements OGrafGraphic {
  static override styles = raceClockStyles;

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  private data: RaceClockData | undefined = undefined;
  private parts: RaceClockParts | undefined = undefined;
  private readonly runningTimelines = new Set<RaceClockTimeline>();
  private runningPanelTimeline: RaceClockTimeline | undefined = undefined;
  private runningFlagChange: RunningFlagChange | undefined = undefined;
  private readonly clockTicker: ClockTicker = createClockTicker({
    onFrame: () => this.redrawClockTime(),
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (frameId) => cancelAnimationFrame(frameId),
  });

  override render() {
    return renderRaceClockTemplate();
  }

  /**
   * OGraf load: checks the data, waits for the first render and the theme's font, draws
   * off air. A graphic is loaded once; a second load answers 409 rather than half
   * resetting one that may be on air. Bad data leaves it unloaded, so load can be tried
   * again.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompleteRaceClockData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';

    // What could go wrong: a renderer calling load on an element not yet in the page
    // waits here until it is added, because Lit renders only connected elements.
    await this.updateComplete;
    // The element itself is where the face's token is read: custom properties reach
    // inside the shadow root, so the wait follows the theme on the page.
    await waitForThemeFontsToBeReady(this);

    // A dispose that came while load was waiting must win; going on would bring a
    // disposed graphic back to life.
    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }

    const parts = findRaceClockParts(this.renderRoot);
    this.parts = parts;
    this.data = dataCheck.data;
    writeSessionCaptionAndLaps(parts, dataCheck.data);
    writeClockTimeAt(parts, dataCheck.data, readServerAlignedTimeMs());
    showFlagStateAtOnce(parts, dataCheck.data.state);
    showFlagBandAtOnce(parts, isFlagBandShown(dataCheck.data));
    placePanelOffAir(parts);
    this.lifecycle = 'offAir';
    return okAnswer;
  }

  /** OGraf playAction: animates the clock in (step 0); a step past it means stop. */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: raceClockStepCount,
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
    this.redrawClockTime();
    this.clockTicker.start();
    await this.runPanelTimeline(buildPlayInTimeline(this.requireParts()), skipAnimation);

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    // A stop during the play-in took the clock off again: report the step actually on
    // air (none), so a renderer tracking steps from this answer stays in step.
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    return { statusCode: 200, currentStep: target.step };
  }

  /** OGraf stopAction: animates the clock out and resolves once it is off screen. */
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
    await this.runPanelTimeline(
      buildStopOutTimeline(this.requireParts()),
      params.skipAnimation ?? false,
    );

    // A play may have arrived during the out animation; only then keep the clock ticking.
    if (this.readLifecycleNow() !== 'onAir') {
      this.clockTicker.stop();
    }
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load, on air or off
   * (João's ruling: the server may correct the data before play or after stop). On air
   * a flag change crossfades the new band in and a band switch grows or shrinks the
   * card; off air both are simply drawn, ready for play.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataBeforeUpdate = this.requireData();
    const dataCheck = mergePartialUpdateIntoRaceClockData(dataBeforeUpdate, params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }

    this.data = dataCheck.data;
    writeSessionCaptionAndLaps(this.requireParts(), dataCheck.data);
    this.redrawClockTime();
    const skipAnimation = params.skipAnimation ?? false;
    const isFlagChange = dataCheck.data.state !== dataBeforeUpdate.state;
    const isBandChange = isFlagBandShown(dataCheck.data) !== isFlagBandShown(dataBeforeUpdate);
    if (isFlagChange) {
      await this.changeFlagState(dataCheck.data.state, skipAnimation);
    }
    if (isBandChange) {
      await this.changeFlagBand(isFlagBandShown(dataCheck.data), skipAnimation);
    }
    return okAnswer;
  }

  /** OGraf customAction: the race clock has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /**
   * OGraf dispose: stops the frame loop and ends every timeline; pending actions resolve.
   * OGraf passes an empty params object, which the race clock has no use for.
   */
  async dispose(): Promise<OGrafReturnPayload> {
    this.lifecycle = 'disposed';
    this.clockTicker.stop();
    for (const timeline of [...this.runningTimelines]) {
      finishTimelineAtOnce(timeline);
    }
    this.runningTimelines.clear();
    this.runningPanelTimeline = undefined;
    this.runningFlagChange = undefined;
    return okAnswer;
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

  private requireParts(): RaceClockParts {
    if (this.parts === undefined) {
      throw new Error('race clock parts are read only after load; this is a bug in race-clock.ts');
    }
    return this.parts;
  }

  private requireData(): RaceClockData {
    if (this.data === undefined) {
      throw new Error('race clock data is read only after load; this is a bug in race-clock.ts');
    }
    return this.data;
  }

  /**
   * Called on every frame while on air: writes the clock time if it changed. "Now" is
   * the shared server-aligned time, never Date.now(): the reading in the data was
   * stamped by the server's clock, and this machine's clock may differ from it.
   * What could go wrong: on a page where no renderer has recorded a message from the
   * server (the preview page, or the first moments of a renderer) that time is this
   * machine's own, and the clock is off by whatever the two machines differ.
   */
  private redrawClockTime(): void {
    if (this.data === undefined || this.parts === undefined) {
      return;
    }
    writeClockTimeAt(this.parts, this.data, readServerAlignedTimeMs());
  }

  /**
   * Changes the flag state: on air the new band crossfades in over the current one;
   * off air nobody would see it, so the new flag is drawn at once, ready for play.
   */
  private async changeFlagState(flagState: FlagState, skipAnimation: boolean): Promise<void> {
    const parts = this.requireParts();
    this.finishRunningFlagChange();
    if (this.lifecycle !== 'onAir') {
      showFlagStateAtOnce(parts, flagState);
      return;
    }
    prepareIncomingFlagLayer(parts, flagState);
    await this.runFlagChange(
      buildFlagChangeTimeline(parts),
      () => showFlagStateAtOnce(parts, flagState),
      skipAnimation,
    );
  }

  /**
   * Switches the band on or off: on air the card grows or shrinks by the band's height
   * while the band fades; off air the card is simply redrawn at its new height. The
   * heights come from the drawn card around the switch, so no pixel value lives here.
   */
  private async changeFlagBand(isShown: boolean, skipAnimation: boolean): Promise<void> {
    const parts = this.requireParts();
    this.finishRunningFlagChange();
    const toggle = showFlagBandAtOnceAndMeasureChange(parts, isShown);
    if (this.lifecycle !== 'onAir') {
      return;
    }
    await this.runFlagChange(
      buildFlagBandToggleTimeline(parts, toggle),
      () => showFlagBandAtOnce(parts, isShown),
      skipAnimation,
    );
  }

  /**
   * Runs a flag change (crossfade or band toggle) and settles it when it ends. Only the
   * latest change may settle; an older one was settled when it was cut short, so two
   * changes in a row never tangle.
   */
  private async runFlagChange(
    timeline: RaceClockTimeline,
    settleAtOnce: () => void,
    skipAnimation: boolean,
  ): Promise<void> {
    const flagChange: RunningFlagChange = { timeline, settleAtOnce };
    this.runningFlagChange = flagChange;
    await this.runTimeline(timeline, skipAnimation);

    const isStillTheLatestChange = this.runningFlagChange === flagChange;
    if (isStillTheLatestChange && this.readLifecycleNow() !== 'disposed') {
      this.runningFlagChange = undefined;
      flagChange.settleAtOnce();
    }
  }

  private finishRunningFlagChange(): void {
    const runningChange = this.runningFlagChange;
    if (runningChange === undefined) {
      return;
    }
    this.runningFlagChange = undefined;
    finishTimelineAtOnce(runningChange.timeline);
    runningChange.settleAtOnce();
  }

  /** Runs an in or out animation; one still running is finished at once first. */
  private async runPanelTimeline(
    timeline: RaceClockTimeline,
    skipAnimation: boolean,
  ): Promise<void> {
    if (this.runningPanelTimeline !== undefined) {
      finishTimelineAtOnce(this.runningPanelTimeline);
    }
    this.runningPanelTimeline = timeline;
    await this.runTimeline(timeline, skipAnimation);
    if (this.runningPanelTimeline === timeline) {
      this.runningPanelTimeline = undefined;
    }
  }

  /** Plays a timeline to its end, keeping track of it so dispose can end it early. */
  private async runTimeline(timeline: RaceClockTimeline, skipAnimation: boolean): Promise<void> {
    this.runningTimelines.add(timeline);
    await playTimelineToTheEnd(timeline, { skipAnimation });
    this.runningTimelines.delete(timeline);
  }
}

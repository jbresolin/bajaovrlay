/**
 * The race clock OGraf graphic: session name, running race time, leader laps and a flag
 * band. This file owns the OGraf lifecycle (load, play, update, stop, dispose) and only
 * wires the pieces together; the rules live in named modules: raceClockModel (data),
 * raceClockView (the DOM, changed in place, never rebuilt), playSteps (the OGraf step
 * rule), clockTicker (the frame loop) and raceClockAnimations.
 *
 * The renderer, not this module, picks the tag name and calls customElements.define, as
 * OGraf v1 expects of a graphic's default export.
 */
import { LitElement } from 'lit';

import { type ClockTicker, createClockTicker } from './clockTicker.js';
import { loadDisplayFontOnce } from './displayFont.js';
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
import { choosePlayActionTarget } from './playSteps.js';
import { ptBR } from './ptBR.js';
import {
  buildFlagChangeTimeline,
  buildPlayInTimeline,
  buildStopOutTimeline,
  finishTimelineAtOnce,
  placePanelOffAir,
  playTimelineToTheEnd,
  type RaceClockTimeline,
} from './raceClockAnimations.js';
import {
  type FlagState,
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
  showFlagStateAtOnce,
  writeClockTimeAt,
  writeSessionCaptionAndLaps,
} from './raceClockView.js';

/** Must match "stepCount" in race-clock.ograf.json: play shows the clock, stop hides it. */
const raceClockStepCount = 1;

type Lifecycle = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function refuse(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The race clock graphic; the default export a renderer registers as a custom element. */
export default class RaceClockGraphic extends LitElement implements OGrafGraphic {
  static override styles = raceClockStyles;

  private lifecycle: Lifecycle = 'unloaded';
  private currentStep: number | undefined = undefined;
  private data: RaceClockData | undefined = undefined;
  private parts: RaceClockParts | undefined = undefined;
  private readonly runningTimelines = new Set<RaceClockTimeline>();
  private runningPanelTimeline: RaceClockTimeline | undefined = undefined;
  private runningFlagWipe: { timeline: RaceClockTimeline; flagState: FlagState } | undefined =
    undefined;
  private readonly clockTicker: ClockTicker = createClockTicker({
    onFrame: () => this.redrawClockTime(),
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (frameId) => cancelAnimationFrame(frameId),
  });

  override render() {
    return renderRaceClockTemplate();
  }

  /**
   * OGraf load: checks the data, waits for the first render and the font, draws off air.
   * A graphic is loaded once; a second load answers 409 rather than half resetting one
   * that may be on air. Bad data leaves it unloaded, so load can be tried again.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return refuse(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return refuse(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompleteRaceClockData(params.data);
    if (!dataCheck.isValid) {
      return refuse(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';

    // What could go wrong: a renderer calling load on an element not yet in the page
    // waits here until it is added, because Lit renders only connected elements.
    await this.updateComplete;
    await loadDisplayFontOnce();

    // A dispose that came while load was waiting must win; going on would bring a
    // disposed graphic back to life.
    if (this.readLifecycleNow() === 'disposed') {
      return refuse(409, ptBR.actionProblems.alreadyDisposed);
    }

    const parts = findRaceClockParts(this.renderRoot);
    this.parts = parts;
    this.data = dataCheck.data;
    writeSessionCaptionAndLaps(parts, dataCheck.data);
    writeClockTimeAt(parts, dataCheck.data, Date.now());
    showFlagStateAtOnce(parts, dataCheck.data.state);
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
      return refuse(400, ptBR.actionProblems.invalidPlayStep);
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
      return refuse(409, ptBR.actionProblems.alreadyDisposed);
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

  /** OGraf updateAction: merges partial data in; a flag change wipes the new colour in. */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    if (this.lifecycle !== 'onAir' || this.data === undefined) {
      return refuse(409, ptBR.actionProblems.notOnAirYet);
    }
    const dataCheck = mergePartialUpdateIntoRaceClockData(this.data, params.data);
    if (!dataCheck.isValid) {
      return refuse(400, dataCheck.problem);
    }

    const previousFlagState = this.data.state;
    this.data = dataCheck.data;
    writeSessionCaptionAndLaps(this.requireParts(), dataCheck.data);
    this.redrawClockTime();
    if (dataCheck.data.state !== previousFlagState) {
      await this.wipeInFlagState(dataCheck.data.state, params.skipAnimation ?? false);
    }
    return okAnswer;
  }

  /** OGraf customAction: the race clock has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return refuse(404, ptBR.actionProblems.unknownCustomAction(params.id));
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
    this.runningFlagWipe = undefined;
    return okAnswer;
  }

  /**
   * Reads the lifecycle after an await. Another call (stop, dispose) may have changed it
   * while the animation ran; reading through a method stops TypeScript from assuming
   * it is still the value it had before the await.
   */
  private readLifecycleNow(): Lifecycle {
    return this.lifecycle;
  }

  private refuseUnlessLoaded(): OGrafReturnPayload | undefined {
    if (this.lifecycle === 'unloaded' || this.lifecycle === 'loading') {
      return refuse(409, ptBR.actionProblems.notLoadedYet);
    }
    if (this.lifecycle === 'disposed') {
      return refuse(409, ptBR.actionProblems.alreadyDisposed);
    }
    return undefined;
  }

  private requireParts(): RaceClockParts {
    if (this.parts === undefined) {
      throw new Error('race clock parts are read only after load; this is a bug in race-clock.ts');
    }
    return this.parts;
  }

  /** Called on every frame while on air: writes the clock time if it changed. */
  private redrawClockTime(): void {
    if (this.data === undefined || this.parts === undefined) {
      return;
    }
    writeClockTimeAt(this.parts, this.data, Date.now());
  }

  /**
   * Wipes a new flag state in over the current one. A wipe still running from an earlier
   * update is finished at once first, so two flag changes in a row never tangle.
   */
  private async wipeInFlagState(flagState: FlagState, skipAnimation: boolean): Promise<void> {
    const parts = this.requireParts();
    this.finishRunningFlagWipe();

    prepareIncomingFlagLayer(parts, flagState);
    const wipeTimeline = buildFlagChangeTimeline(parts);
    this.runningFlagWipe = { timeline: wipeTimeline, flagState };
    await this.runTimeline(wipeTimeline, skipAnimation);

    // Only the latest wipe may settle the flag; an older one was settled when cut short.
    const isStillTheLatestWipe = this.runningFlagWipe?.timeline === wipeTimeline;
    if (isStillTheLatestWipe && this.readLifecycleNow() !== 'disposed') {
      this.runningFlagWipe = undefined;
      showFlagStateAtOnce(parts, flagState);
    }
  }

  private finishRunningFlagWipe(): void {
    const runningWipe = this.runningFlagWipe;
    if (runningWipe === undefined) {
      return;
    }
    this.runningFlagWipe = undefined;
    finishTimelineAtOnce(runningWipe.timeline);
    showFlagStateAtOnce(this.requireParts(), runningWipe.flagState);
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

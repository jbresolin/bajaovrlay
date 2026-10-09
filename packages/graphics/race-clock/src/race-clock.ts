/**
 * The race clock OGraf graphic: session name, running race time, leader laps and a flag
 * band. This file only wires the pieces together; the rules live in named modules:
 * raceClockModel (data), clockExtrapolation and clockFormatting (the time shown),
 * playSteps (the OGraf step rule), clockTicker (the frame loop) and raceClockAnimations.
 *
 * The DOM is drawn once by Lit; after that only text and data-flag-state attributes are
 * changed in place, never rebuilt. The renderer, not this module, picks the tag name and
 * calls customElements.define, as OGraf v1 expects of a graphic's default export.
 */
import { html, LitElement } from 'lit';

import { computeClockTimeMsAtWallClock } from './clockExtrapolation.js';
import { formatClockTimeAsHoursMinutesSeconds } from './clockFormatting.js';
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
  hideIncomingFlagLayer,
  placePanelOffAir,
  playTimelineToTheEnd,
  type RaceClockAnimatedElements,
} from './raceClockAnimations.js';
import {
  type FlagState,
  mergePartialUpdateIntoRaceClockData,
  parseCompleteRaceClockData,
  type RaceClockData,
} from './raceClockModel.js';
import { raceClockStyles } from './raceClockStyles.js';

/** Must match "stepCount" in race-clock.ograf.json: play shows the clock, stop hides it. */
const raceClockStepCount = 1;

type Lifecycle = 'unloaded' | 'offAir' | 'onAir' | 'disposed';
type Timeline = Parameters<typeof finishTimelineAtOnce>[0];

/** The elements whose text or flag state changes after the first render. */
type RaceClockParts = RaceClockAnimatedElements & {
  sessionName: HTMLElement;
  clockTime: HTMLElement;
  clockCaption: HTMLElement;
  laps: HTMLElement;
  currentFlagLayer: HTMLElement;
  currentFlagLabel: HTMLElement;
  incomingFlagLabel: HTMLElement;
};

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function refuse(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** Changes an element's text only when it differs, so unchanged frames touch nothing. */
function writeTextIfChanged(element: HTMLElement, text: string): void {
  if (element.textContent !== text) {
    element.textContent = text;
  }
}

/** The race clock graphic; the default export a renderer registers as a custom element. */
export default class RaceClockGraphic extends LitElement implements OGrafGraphic {
  static override styles = raceClockStyles;

  private lifecycle: Lifecycle = 'unloaded';
  private currentStep: number | undefined = undefined;
  private data: RaceClockData | undefined = undefined;
  private parts: RaceClockParts | undefined = undefined;
  private readonly runningTimelines = new Set<Timeline>();
  private runningPanelTimeline: Timeline | undefined = undefined;
  private runningFlagWipe: { timeline: Timeline; flagState: FlagState } | undefined = undefined;
  private readonly clockTicker: ClockTicker = createClockTicker({
    onFrame: () => this.redrawClockTime(),
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (frameId) => cancelAnimationFrame(frameId),
  });

  override render() {
    return html`
      <section class="race-clock-panel" data-testid="race-clock-panel">
        <div class="session-row">
          <span class="session-name" data-testid="race-clock-session-name"></span>
        </div>
        <div class="clock-row">
          <span class="clock-time" data-testid="race-clock-time"></span>
          <div class="clock-details">
            <span class="clock-caption" data-testid="race-clock-caption"></span>
            <span class="laps" data-testid="race-clock-laps"></span>
          </div>
        </div>
        <div class="flag-band" data-testid="race-clock-flag-band">
          <div class="flag-layer" data-testid="race-clock-current-flag-layer">
            <span class="flag-label" data-testid="race-clock-flag-label"></span>
          </div>
          <div class="flag-layer incoming-flag-layer" data-testid="race-clock-incoming-flag-layer">
            <span class="flag-label" data-testid="race-clock-incoming-flag-label"></span>
          </div>
        </div>
      </section>
    `;
  }

  /** OGraf load: checks the data, waits for the first render and the font, draws off air. */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return refuse(409, ptBR.actionProblems.alreadyDisposed);
    }
    const dataCheck = parseCompleteRaceClockData(params.data);
    if (!dataCheck.isValid) {
      return refuse(400, dataCheck.problem);
    }

    // What could go wrong: a renderer calling load on an element not yet in the page
    // waits here until it is added, because Lit renders only connected elements.
    await this.updateComplete;
    await loadDisplayFontOnce();

    this.data = dataCheck.data;
    this.parts = this.findPartsInShadowRoot();
    this.writeTextParts();
    this.redrawClockTime();
    this.showFlagStateAtOnce(dataCheck.data.state);
    placePanelOffAir(this.parts);
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
    this.writeTextParts();
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
    if (this.lifecycle === 'unloaded') {
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

  private findPartsInShadowRoot(): RaceClockParts {
    const findPart = (testId: string): HTMLElement => {
      const part = this.renderRoot.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      if (part === null) {
        throw new Error(`race clock part "${testId}" is missing from render(); this is a bug`);
      }
      return part;
    };
    return {
      panel: findPart('race-clock-panel'),
      sessionName: findPart('race-clock-session-name'),
      clockTime: findPart('race-clock-time'),
      clockCaption: findPart('race-clock-caption'),
      laps: findPart('race-clock-laps'),
      flagBand: findPart('race-clock-flag-band'),
      currentFlagLayer: findPart('race-clock-current-flag-layer'),
      currentFlagLabel: findPart('race-clock-flag-label'),
      incomingFlagLayer: findPart('race-clock-incoming-flag-layer'),
      incomingFlagLabel: findPart('race-clock-incoming-flag-label'),
    };
  }

  /** Writes every text except the clock time and the flag, which have their own paths. */
  private writeTextParts(): void {
    if (this.data === undefined || this.parts === undefined) {
      return;
    }
    writeTextIfChanged(this.parts.sessionName, this.data.sessionName);
    writeTextIfChanged(this.parts.clockCaption, ptBR.clockModeCaptions[this.data.clockMode]);
    const laps = this.data.lapsCompletedByLeader;
    this.parts.laps.hidden = laps === undefined;
    writeTextIfChanged(this.parts.laps, laps === undefined ? '' : ptBR.lapsCompletedByLeader(laps));
  }

  /** Called on every frame while on air: works out the time now and writes it if it changed. */
  private redrawClockTime(): void {
    if (this.data === undefined || this.parts === undefined) {
      return;
    }
    const clockTimeMs = computeClockTimeMsAtWallClock(this.data, Date.now());
    writeTextIfChanged(this.parts.clockTime, formatClockTimeAsHoursMinutesSeconds(clockTimeMs));
  }

  /** Shows a flag state on the current layer straight away and hides the incoming one. */
  private showFlagStateAtOnce(flagState: FlagState): void {
    const parts = this.requireParts();
    parts.currentFlagLayer.dataset.flagState = flagState;
    writeTextIfChanged(parts.currentFlagLabel, ptBR.flagLabels[flagState]);
    hideIncomingFlagLayer(parts);
  }

  /**
   * Wipes a new flag state in over the current one. A wipe still running from an earlier
   * update is finished at once first, so two flag changes in a row never tangle.
   */
  private async wipeInFlagState(flagState: FlagState, skipAnimation: boolean): Promise<void> {
    const parts = this.requireParts();
    this.finishRunningFlagWipe();

    parts.incomingFlagLayer.dataset.flagState = flagState;
    writeTextIfChanged(parts.incomingFlagLabel, ptBR.flagLabels[flagState]);
    const wipeTimeline = buildFlagChangeTimeline(parts);
    this.runningFlagWipe = { timeline: wipeTimeline, flagState };
    await this.runTimeline(wipeTimeline, skipAnimation);

    // Only the latest wipe may settle the flag; an older one was settled when cut short.
    const isStillTheLatestWipe = this.runningFlagWipe?.timeline === wipeTimeline;
    if (isStillTheLatestWipe && this.lifecycle !== 'disposed') {
      this.runningFlagWipe = undefined;
      this.showFlagStateAtOnce(flagState);
    }
  }

  private finishRunningFlagWipe(): void {
    const runningWipe = this.runningFlagWipe;
    if (runningWipe === undefined) {
      return;
    }
    this.runningFlagWipe = undefined;
    finishTimelineAtOnce(runningWipe.timeline);
    this.showFlagStateAtOnce(runningWipe.flagState);
  }

  /** Runs an in or out animation; one still running is finished at once first. */
  private async runPanelTimeline(timeline: Timeline, skipAnimation: boolean): Promise<void> {
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
  private async runTimeline(timeline: Timeline, skipAnimation: boolean): Promise<void> {
    this.runningTimelines.add(timeline);
    await playTimelineToTheEnd(timeline, { skipAnimation });
    this.runningTimelines.delete(timeline);
  }
}

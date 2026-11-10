/**
 * The match bug OGraf graphic (BAJAOVRLAY-65): the Super Prime's match "agora", small and
 * meant to stay on air, in the corner the item picks. This file owns the OGraf lifecycle
 * (load, play, update, stop, dispose) in the team card's shape and only wires the pieces
 * together: matchBugModel (data and what it shows), matchBugView (the DOM, drawn by Lit),
 * playSteps (the OGraf step rule), matchBugAnimations (the fade) and the kit's scrolling
 * texts (a short name too long for its box scrolls inside it).
 *
 * The bug is fed live: when the operator moves "agora", or a result arrives, the server
 * sends an update and the bug redraws in place, with no motion. When "agora" is emptied
 * every field leaves the air and the bug, still on air, shows nothing until a match comes
 * back; it never keeps a stale match.
 *
 * The renderer, not this module, picks the tag name and calls customElements.define, as
 * OGraf v1 expects of a graphic's default export.
 */
import { carChipStyles } from '@bajaovrlay/graphics-kit/carChipStyles';
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
  buildFadeInTimeline,
  buildFadeOutTimeline,
  type MatchBugTimeline,
  placePanelOffAir,
} from './matchBugAnimations.js';
import {
  type MatchBugData,
  mergePartialUpdateIntoMatchBugData,
  parseCompleteMatchBugData,
  readMatchBugLook,
} from './matchBugModel.js';
import { matchBugStyles } from './matchBugStyles.js';
import { findMatchBugPanel, renderMatchBugTemplate } from './matchBugView.js';
import { ptBR } from './ptBR.js';

/** Must match "stepCount" in bracket-match-bug.ograf.json: play shows the bug, stop hides it. */
const matchBugStepCount = 1;

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The match bug graphic; the default export a renderer registers as a custom element. */
export default class BracketMatchBugGraphic extends LitElement implements OGrafGraphic {
  static override styles = [scrollingTextStyles, carChipStyles, matchBugStyles];

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  // Read by render(); not a Lit reactive property, so the bug is redrawn only when this
  // file asks (redrawWithData), never by surprise.
  private data: MatchBugData | undefined = undefined;
  private panel: HTMLElement | undefined = undefined;
  // One motion at a time (in or out), so one timeline is all there is to end.
  private runningPanelTimeline: MatchBugTimeline | undefined = undefined;
  /** The cycle of the names too long for their box; made at load, once Lit has rendered. */
  private scrollingTextClock: ScrollingTextClock | undefined = undefined;

  override render() {
    const look = this.data === undefined ? undefined : readMatchBugLook(this.data);
    return renderMatchBugTemplate(look);
  }

  /**
   * OGraf load: checks the data, draws it, waits for the theme's face and leaves the bug
   * off air. Empty data is good data (an empty "agora"): the bug loads and shows nothing.
   * A second load answers 409; bad data leaves it unloaded, so load can be tried again.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompleteMatchBugData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';

    // What could go wrong: a renderer calling load on an element not yet in the page
    // waits here until it is added, because Lit renders only connected elements.
    await this.redrawWithData(dataCheck.data);
    const panel = findMatchBugPanel(this.renderRoot);
    this.panel = panel;
    this.scrollingTextClock = createScrollingTextClock({
      root: this.renderRoot,
      tokensSource: this,
    });
    placePanelOffAir(panel);
    await waitForThemeFontsToBeReady(this);

    // A dispose that came while load was waiting must win; going on would bring a
    // disposed graphic back to life.
    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    this.lifecycle = 'offAir';
    return okAnswer;
  }

  /** OGraf playAction: fades the bug in (step 0); a step past it means stop. */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: matchBugStepCount,
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
    await this.runPanelTimeline(buildFadeInTimeline(this.requirePanel()), skipAnimation);

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    // A stop during the fade in took the bug off again: report the step actually on air.
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    this.scrollingTextClock?.start();
    return { statusCode: 200, currentStep: target.step };
  }

  /** OGraf stopAction: fades the bug out and resolves once it is invisible. */
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
    this.scrollingTextClock?.holdTheTextsForThePlayOut();
    await this.runPanelTimeline(
      buildFadeOutTimeline(this.requirePanel()),
      params.skipAnimation ?? false,
    );
    this.scrollingTextClock?.stopAfterThePlayOut();
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load, on air or off, and
   * redraws in place with no animation: another match "agora", a win, the winner, or the
   * match leaving the air (its fields sent as undefined), after which the bug shows
   * nothing. Refused only before load, after dispose, and for bad data.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoMatchBugData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    await this.redrawWithData(dataCheck.data);
    return okAnswer;
  }

  /**
   * Lit's hook for the element leaving the page: the scrolling names' cycle stops, so a
   * layer a renderer removed without dispose leaves no animation running inside OBS.
   */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.scrollingTextClock?.stop();
  }

  /** OGraf customAction: the match bug has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /** OGraf dispose: ends a running fade and the scrolling names; pending actions resolve. */
  async dispose(): Promise<OGrafReturnPayload> {
    this.lifecycle = 'disposed';
    this.scrollingTextClock?.stop();
    const runningTimeline = this.runningPanelTimeline;
    this.runningPanelTimeline = undefined;
    if (runningTimeline !== undefined) {
      finishTimelineAtOnce(runningTimeline);
    }
    return okAnswer;
  }

  /** Keeps the data and waits until Lit has drawn it. */
  private async redrawWithData(data: MatchBugData): Promise<void> {
    this.data = data;
    this.requestUpdate();
    await this.updateComplete;
  }

  /**
   * Reads the lifecycle after an await. Another call (stop, dispose) may have changed it
   * meanwhile; reading through a method stops TypeScript from assuming it has not.
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

  private requirePanel(): HTMLElement {
    if (this.panel === undefined) {
      throw new Error(
        'the match bug panel is read only after load; this is a bug in bracket-match-bug.ts',
      );
    }
    return this.panel;
  }

  private requireData(): MatchBugData {
    if (this.data === undefined) {
      throw new Error(
        'match bug data is read only after load; this is a bug in bracket-match-bug.ts',
      );
    }
    return this.data;
  }

  /**
   * Runs a fade, kept so dispose can end it early; one still running is finished at once
   * first, so a fade out that comes during the fade in never tangles with it.
   */
  private async runPanelTimeline(timeline: MatchBugTimeline, skipAnimation: boolean): Promise<void> {
    if (this.runningPanelTimeline !== undefined) {
      finishTimelineAtOnce(this.runningPanelTimeline);
    }
    this.runningPanelTimeline = timeline;
    await playTimelineToTheEnd(timeline, { skipAnimation });
    if (this.runningPanelTimeline === timeline) {
      this.runningPanelTimeline = undefined;
    }
  }
}

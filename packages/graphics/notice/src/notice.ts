/**
 * The notice OGraf graphic: the card under the bug for a fastest lap, or for a penalty,
 * warning or incident from race control. This file owns the OGraf lifecycle (load, play,
 * update, stop, dispose) and only wires the pieces together; the rules live in named
 * modules: noticeModel (data), noticeView (the DOM, written in place, never rebuilt),
 * playSteps (the OGraf step rule) and noticeAnimations (GSAP timelines from the theme's
 * motion tokens). The wait for the theme's face before the first draw is the theme's own
 * (`@bajaovrlay/theme/fonts`).
 *
 * Deliberate trade-off: the design says a notice leaves by itself after
 * `--motion-notice-hold` (8 s), but this graphic never takes itself off air. The server
 * owns what is on air (docs/00-concept.md, rule 1): the event rule that took the notice
 * clears it after its duration, so the operator's page, the server's state and the screen
 * always agree. A graphic that left by itself would be off screen while the server still
 * showed it on air. What could go wrong: a notice taken by hand with no auto-out stays up
 * until the operator clears it.
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
  buildPlayInTimeline,
  buildStopOutTimeline,
  type NoticeTimeline,
  placePanelOffAir,
} from './noticeAnimations.js';
import {
  mergePartialUpdateIntoNoticeData,
  type NoticeData,
  parseCompleteNoticeData,
} from './noticeModel.js';
import { noticeStyles } from './noticeStyles.js';
import {
  findNoticeParts,
  type NoticeParts,
  renderNoticeTemplate,
  writeNoticeData,
} from './noticeView.js';
import { ptBR } from './ptBR.js';

/** Must match "stepCount" in notice.ograf.json: play shows the notice, stop hides it. */
const noticeStepCount = 1;

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The notice graphic; the default export a renderer registers as a custom element. */
export default class NoticeGraphic extends LitElement implements OGrafGraphic {
  static override styles = [scrollingTextStyles, noticeStyles];

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  private data: NoticeData | undefined = undefined;
  private parts: NoticeParts | undefined = undefined;
  // The notice has one motion at a time (in or out), so one timeline is all there is to end.
  private runningPanelTimeline: NoticeTimeline | undefined = undefined;
  /**
   * The cycle of the texts too long for the panel (BAJAOVRLAY-55). Made at load: the
   * shadow root it watches exists only once Lit has rendered.
   */
  private scrollingTextClock: ScrollingTextClock | undefined = undefined;

  override render() {
    return renderNoticeTemplate();
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
    const dataCheck = parseCompleteNoticeData(params.data);
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

    const parts = findNoticeParts(this.renderRoot);
    this.parts = parts;
    this.scrollingTextClock = createScrollingTextClock({
      root: this.renderRoot,
      tokensSource: this,
    });
    this.data = dataCheck.data;
    writeNoticeData(parts, dataCheck.data);
    placePanelOffAir(parts);
    this.lifecycle = 'offAir';
    return okAnswer;
  }

  /**
   * OGraf playAction: animates the notice in (step 0); a step past it means stop. It
   * stays on air until stopAction: the hold is the server's, not the graphic's (see the
   * trade-off at the top of this file).
   */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: noticeStepCount,
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
    await this.runPanelTimeline(buildPlayInTimeline(this.requireParts()), skipAnimation);

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    // A stop during the play-in took the notice off again: report the step actually on
    // air (none), so a renderer tracking steps from this answer stays in step.
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    this.scrollingTextClock?.start();
    return { statusCode: 200, currentStep: target.step };
  }

  /** OGraf stopAction: animates the notice out and resolves once it is off screen. */
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
    await this.runPanelTimeline(
      buildStopOutTimeline(this.requireParts()),
      params.skipAnimation ?? false,
    );
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load, on air or off,
   * and redraws the card in place with no animation (a changed time or reason is read,
   * not watched). Refused only before load and after dispose.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoNoticeData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }

    this.data = dataCheck.data;
    writeNoticeData(this.requireParts(), dataCheck.data);
    return okAnswer;
  }

  /**
   * Lit's hook for the element leaving the page: the scrolling texts' cycle stops, so a
   * layer a renderer removed without dispose leaves no timeline running inside OBS.
   */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.scrollingTextClock?.stop();
  }

  /** OGraf customAction: the notice has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /**
   * OGraf dispose: ends every timeline; pending actions resolve. OGraf passes an empty
   * params object, which the notice has no use for.
   */
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

  private requireParts(): NoticeParts {
    if (this.parts === undefined) {
      throw new Error('notice parts are read only after load; this is a bug in notice.ts');
    }
    return this.parts;
  }

  private requireData(): NoticeData {
    if (this.data === undefined) {
      throw new Error('notice data is read only after load; this is a bug in notice.ts');
    }
    return this.data;
  }

  /**
   * Runs an in or out animation, kept so dispose can end it early; one still running is
   * finished at once first, so an out that comes during the in never tangles with it.
   */
  private async runPanelTimeline(timeline: NoticeTimeline, skipAnimation: boolean): Promise<void> {
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

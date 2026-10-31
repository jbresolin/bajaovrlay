/**
 * The countdown OGraf graphic (BAJAOVRLAY-46): the count to a session's start, as the race
 * clock's card without the band (`card`, on the clock layer) or the narrow waiting board
 * (`fullscreen`). This file owns the OGraf lifecycle (load, play, update, stop, dispose) in
 * the sponsor bug's shape and only wires the pieces together: countdownModel (data),
 * countdownView (the DOM), countdownAnimations (GSAP from the theme's tokens), the kit's
 * playSteps, motionTimelineRunner and countdownClock.
 *
 * The count is the graphic's own (decided): from play on, the kit's countdownClock writes
 * it every frame at the server-aligned "now" until "0:00", where it stops by itself. Its
 * frame loop is stopped on stop, on dispose and when the element leaves the page, so
 * nothing runs in OBS for a countdown nobody sees. An update moves the target: on air the
 * count is redrawn and ticks again; off air (also during the stop-out) the data is only
 * stored and drawn, and the count starts again at the next play.
 *
 * The renderer, not this module, picks the tag name and calls customElements.define, as
 * OGraf v1 expects of a graphic's default export.
 */
import { type CountdownClock, createCountdownClock } from '@bajaovrlay/graphics-kit/countdownClock';
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
import { scrollingTextStyles } from '@bajaovrlay/graphics-kit/scrollingTextStyles';
import {
  createScrollingTextClock,
  type ScrollingTextClock,
} from '@bajaovrlay/graphics-kit/scrollingTextWhenTooLong';
import { writeTextIfChanged } from '@bajaovrlay/graphics-kit/textInPlace';
import { waitForThemeFontsToBeReady } from '@bajaovrlay/theme/fonts';
import { LitElement } from 'lit';

import {
  buildCountdownPlayInTimeline,
  buildCountdownStopOutTimeline,
  placeCountdownOffAir,
  placeCountdownOnAir,
} from './countdownAnimations.js';
import {
  type CountdownData,
  type CountdownLayout,
  mergePartialUpdateIntoCountdownData,
  parseCompleteCountdownData,
} from './countdownModel.js';
import { countdownStyles } from './countdownStyles.js';
import {
  type CountdownPieces,
  findCountdownCount,
  findCountdownPieces,
  renderCountdownTemplate,
} from './countdownView.js';
import { ptBR } from './ptBR.js';

/** Must match "stepCount" in countdown.ograf.json: play shows the countdown, stop hides it. */
const countdownStepCount = 1;

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The countdown graphic; the default export a renderer registers as a custom element. */
export default class CountdownGraphic extends LitElement implements OGrafGraphic {
  static override styles = [scrollingTextStyles, countdownStyles];

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  // Read by render(); not a Lit reactive property, so the countdown is redrawn only when
  // this file asks (redrawWithData), never by surprise.
  private data: CountdownData | undefined = undefined;
  private pieces: CountdownPieces | undefined = undefined;
  // The layout on the page, which an update stored during the stop-out may not match yet.
  private layoutDrawn: CountdownLayout | undefined = undefined;
  private readonly motions: MotionTimelineRunner = createMotionTimelineRunner();
  private readonly countdownClock: CountdownClock = createCountdownClock({
    readStartsAtMs: () => this.data?.startsAtMs,
    writeCountText: (countText) => this.writeCountText(countText),
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (frameId) => window.cancelAnimationFrame(frameId),
  });
  /** The session name's and event line's scroll cycle (BAJAOVRLAY-55), made at load. */
  private scrollingTextClock: ScrollingTextClock | undefined = undefined;

  override render() {
    return renderCountdownTemplate(this.data);
  }

  /**
   * OGraf load: checks the data, draws it with the count as it is now, waits for the
   * theme's font, and leaves the countdown off air. Loaded once; a second load answers
   * 409. Bad data leaves it unloaded, so load can be tried again.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompleteCountdownData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';

    // What could go wrong: a renderer calling load on an element not yet in the page
    // waits here until it is added, because Lit renders only connected elements.
    await this.redrawWithData(dataCheck.data);
    this.scrollingTextClock = createScrollingTextClock({
      root: this.renderRoot,
      tokensSource: this,
    });
    placeCountdownOffAir(this.requirePieces());
    this.countdownClock.redraw();
    await waitForThemeFontsToBeReady(this);

    // A dispose that came while load was waiting must win.
    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    this.lifecycle = 'offAir';
    return okAnswer;
  }

  /**
   * OGraf playAction: starts the count and animates the countdown in (step 0); a step past
   * it means stop. It stays on air until stopAction.
   */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: countdownStepCount,
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
    // The count ticks from the first frame of the play-in, so it is right as it rises.
    this.countdownClock.startTicking();
    await this.motions.run(buildCountdownPlayInTimeline(this.requirePieces()), skipAnimation);

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    // A stop during the play-in took it off again: report the step on air (none).
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    this.scrollingTextClock?.start();
    return { statusCode: 200, currentStep: target.step };
  }

  /** OGraf stopAction: stops the count, animates the countdown out, resolves once off screen. */
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
    this.countdownClock.stopTicking();
    this.scrollingTextClock?.stop();
    await this.motions.run(
      buildCountdownStopOutTimeline(this.requirePieces()),
      params.skipAnimation ?? false,
    );
    // An update that came during the stop-out was only stored; drawn now, off air.
    if (this.readLifecycleNow() === 'offAir') {
      await this.drawTheStoredDataOffAir();
    }
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load and redraws in
   * place with no animation (a session renamed, a start moved by an edit of the schedule).
   * On air the count reads the new start at once and ticks again (a later start counts
   * again after "0:00"); off air the data is drawn; during the stop-out it is only
   * stored, and drawn once the countdown has faded. A change of layout draws the other layout in the countdown's place, on air or
   * off as it was. Refused only before load and after dispose.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoCountdownData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }

    if (this.lifecycle !== 'onAir' && this.motions.isRunning()) {
      // During the stop-out the fading pieces are left alone: stopAction draws the data
      // stored here once they have faded.
      this.data = dataCheck.data;
      return okAnswer;
    }
    const layoutBefore = this.layoutDrawn;
    await this.redrawWithData(dataCheck.data);
    if (dataCheck.data.layout !== layoutBefore) {
      this.placeNewLayoutAsTheOldOneWas();
    }
    this.countdownClock.redraw();
    if (this.lifecycle === 'onAir') {
      this.countdownClock.startTicking();
    }
    return okAnswer;
  }

  /** OGraf customAction: the countdown has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /**
   * Lit's hook for the element leaving the page: the count stops, so a layer a renderer
   * removed without dispose never goes on ticking. Not restarted if the element comes
   * back: a renderer loads a new element for a new layer.
   */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.countdownClock.stopTicking();
    this.scrollingTextClock?.stop();
  }

  /** OGraf dispose: stops the count and ends every timeline; pending actions resolve. */
  async dispose(): Promise<OGrafReturnPayload> {
    this.lifecycle = 'disposed';
    this.countdownClock.stopTicking();
    this.scrollingTextClock?.stop();
    this.motions.finishEveryTimelineAtOnce();
    return okAnswer;
  }

  /** Keeps the data, waits until Lit has drawn it, and finds the layout's pieces. */
  private async redrawWithData(data: CountdownData): Promise<void> {
    this.data = data;
    this.requestUpdate();
    await this.updateComplete;
    this.pieces = findCountdownPieces(this.renderRoot);
    this.layoutDrawn = data.layout;
  }

  /** Draws the data stored during the stop-out, every piece off air, the count rewritten. */
  private async drawTheStoredDataOffAir(): Promise<void> {
    await this.redrawWithData(this.requireData());
    placeCountdownOffAir(this.requirePieces());
    this.countdownClock.redraw();
  }

  /** The other layout's pieces, new on the page, put on air at once or left off air. */
  private placeNewLayoutAsTheOldOneWas(): void {
    const pieces = this.requirePieces();
    if (this.lifecycle === 'onAir') {
      placeCountdownOnAir(pieces);
      return;
    }
    placeCountdownOffAir(pieces);
  }

  /** Writes the count where the layout shows it, only when its text changed. */
  private writeCountText(countText: string): void {
    const countElement = findCountdownCount(this.renderRoot);
    if (countElement !== undefined) {
      writeTextIfChanged(countElement, countText);
    }
  }

  /**
   * Reads the lifecycle after an await. Another call (stop, dispose) may have changed it
   * while the animation ran; reading through a method stops TypeScript from assuming it
   * is still the value it had before the await.
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

  private requirePieces(): CountdownPieces {
    if (this.pieces === undefined) {
      throw new Error('the countdown pieces are read only after load; a bug in countdown.ts');
    }
    return this.pieces;
  }

  private requireData(): CountdownData {
    if (this.data === undefined) {
      throw new Error('countdown data is read only after load; a bug in countdown.ts');
    }
    return this.data;
  }
}

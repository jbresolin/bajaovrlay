/**
 * The QR card OGraf graphic: the lower third's slot on the one light surface, a code made
 * from the address in the graphic itself, the call to action and the address. This file owns
 * the OGraf lifecycle (load, play, update, stop, dispose) in the team card's shape and only
 * wires the pieces together; the rules live in named modules: qrCardModel (data, the
 * address's rules), qrCodeEncoding (the squares, qrcode-generator), qrCodeLayout (whole px
 * per module), qrCardView (the DOM, drawn by Lit), playSteps (the OGraf step rule) and
 * qrCardAnimations (GSAP timelines from the theme's motion tokens).
 *
 * Load makes the code and waits for the theme's face, so play brings the card in whole.
 * Nothing moves while the card is up but a text too long for it, which scrolls inside its
 * box (BAJAOVRLAY-55); the code never moves. An update redraws the card in place with no motion (a
 * new address is a new code at once, in the same card); one that arrives while the card is
 * lifting out is only stored, and drawn once the card is off screen, so the code never
 * changes under a fading card.
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

import { ptBR } from './ptBR.js';
import {
  buildPlayInTimeline,
  buildStopOutTimeline,
  placePanelOffAir,
  type QrCardTimeline,
} from './qrCardAnimations.js';
import {
  makeQrCodeModulesOfCard,
  mergePartialUpdateIntoQrCardData,
  parseCompleteQrCardData,
  type QrCardData,
} from './qrCardModel.js';
import { qrCardStyles } from './qrCardStyles.js';
import { findQrCardPanel, type QrCardDrawing, renderQrCardTemplate } from './qrCardView.js';
import { planQrCodeDrawing } from './qrCodeLayout.js';

/** Must match "stepCount" in qr-card.ograf.json: play shows the card, stop hides it. */
const qrCardStepCount = 1;

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The QR card graphic; the default export a renderer registers as a custom element. */
export default class QrCardGraphic extends LitElement implements OGrafGraphic {
  static override styles = [scrollingTextStyles, qrCardStyles];

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  // The data last accepted, which the next update merges into.
  private data: QrCardData | undefined = undefined;
  // What render() draws. Not a Lit reactive property, so the card is redrawn only when this
  // file asks (redrawWithData), never by surprise. It lags `data` only during a stop-out.
  private drawing: QrCardDrawing | undefined = undefined;
  private panel: HTMLElement | undefined = undefined;
  // The card has one motion at a time (in or out), so one timeline is all there is to end.
  private runningPanelTimeline: QrCardTimeline | undefined = undefined;
  private isStoppingOut = false;
  private hasDataNotYetDrawn = false;
  /**
   * The cycle of the texts too long for the card (BAJAOVRLAY-55). Made at load: the
   * shadow root it watches exists only once Lit has rendered.
   */
  private scrollingTextClock: ScrollingTextClock | undefined = undefined;

  override render() {
    return renderQrCardTemplate(this.drawing);
  }

  /**
   * OGraf load: checks the data, makes and draws the code, waits for the theme's font, and
   * leaves the card off air. A graphic is loaded once; a second load answers 409 rather
   * than half resetting one that may be on air. Bad data leaves it unloaded, so load can be
   * tried again.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompleteQrCardData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';

    // What could go wrong: a renderer calling load on an element not yet in the page
    // waits here until it is added, because Lit renders only connected elements.
    await this.redrawWithData(dataCheck.data);
    const panel = findQrCardPanel(this.renderRoot);
    this.panel = panel;
    this.scrollingTextClock = createScrollingTextClock({
      root: this.renderRoot,
      tokensSource: this,
    });
    placePanelOffAir({ panel });
    // The element itself is where the face's token is read: custom properties reach
    // inside the shadow root, so the wait follows the theme on the page.
    await waitForThemeFontsToBeReady(this);

    // A dispose that came while load was waiting must win; going on would bring a
    // disposed graphic back to life.
    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    this.lifecycle = 'offAir';
    return okAnswer;
  }

  /**
   * OGraf playAction: animates the card in (step 0); a step past it means stop. It stays
   * on air, still, until stopAction.
   */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: qrCardStepCount,
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

    // A play that cut a stop-out short draws the data stored meanwhile first, still off air,
    // so the card rises with it and nothing redraws during the play-in (gate 2 of PR #27).
    this.isStoppingOut = false;
    if (this.hasDataNotYetDrawn) {
      this.hasDataNotYetDrawn = false;
      await this.redrawWithData(this.requireData());
    }
    this.lifecycle = 'onAir';
    this.currentStep = target.step;
    await this.runPanelTimeline(buildPlayInTimeline({ panel: this.requirePanel() }), skipAnimation);

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    // A stop during the play-in took the card off again: report the step actually on
    // air (none), so a renderer tracking steps from this answer stays in step.
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    this.scrollingTextClock?.start();
    return { statusCode: 200, currentStep: target.step };
  }

  /**
   * OGraf stopAction: animates the card out and resolves once it is off screen; data an
   * update stored meanwhile is drawn then, ready for the next play.
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
    this.isStoppingOut = true;
    await this.runPanelTimeline(
      buildStopOutTimeline({ panel: this.requirePanel() }),
      params.skipAnimation ?? false,
    );
    this.isStoppingOut = false;
    // Only a card still off air is redrawn: a play that came meanwhile drew it already.
    if (this.hasDataNotYetDrawn && this.readLifecycleNow() === 'offAir') {
      this.hasDataNotYetDrawn = false;
      await this.redrawWithData(this.requireData());
    }
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load, on air or off, and
   * redraws the card in place with no animation (a new address is a new code at once).
   * During the stop-out it only stores the data. Refused only before load and after dispose.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoQrCardData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }

    if (this.isStoppingOut) {
      this.data = dataCheck.data;
      this.hasDataNotYetDrawn = true;
      return okAnswer;
    }
    await this.redrawWithData(dataCheck.data);
    return okAnswer;
  }

  /** OGraf customAction: the QR card has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /**
   * OGraf dispose: ends every timeline; pending actions resolve. OGraf passes an empty
   * params object, which the card has no use for.
   */
  async dispose(): Promise<OGrafReturnPayload> {
    this.lifecycle = 'disposed';
    this.scrollingTextClock?.stop();
    this.finishRunningPanelTimelineAtOnce();
    return okAnswer;
  }

  /**
   * Lit's hook for the element leaving the page: a running in or out is ended, so a card a
   * renderer removed without dispose leaves nothing animating behind it.
   */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.scrollingTextClock?.stop();
    this.finishRunningPanelTimelineAtOnce();
  }

  /** Ends the running in or out at once, if any; its action then resolves. */
  private finishRunningPanelTimelineAtOnce(): void {
    const runningTimeline = this.runningPanelTimeline;
    this.runningPanelTimeline = undefined;
    if (runningTimeline !== undefined) {
      finishTimelineAtOnce(runningTimeline);
    }
  }

  /**
   * Keeps the data, makes its code, plans it in the box the theme sets (`--qr-size`, read
   * from this element now, so a theme change is followed at the next draw) and waits until
   * Lit has drawn it.
   */
  private async redrawWithData(data: QrCardData): Promise<void> {
    const modules = makeQrCodeModulesOfCard(data);
    const boxSizePx = Number.parseFloat(getComputedStyle(this).getPropertyValue('--qr-size'));
    this.data = data;
    this.drawing = { data, modules, plan: planQrCodeDrawing(modules.length, boxSizePx) };
    this.requestUpdate();
    await this.updateComplete;
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

  private requirePanel(): HTMLElement {
    if (this.panel === undefined) {
      throw new Error('the QR card element is read only after load; this is a bug in qr-card.ts');
    }
    return this.panel;
  }

  private requireData(): QrCardData {
    if (this.data === undefined) {
      throw new Error('QR card data is read only after load; this is a bug in qr-card.ts');
    }
    return this.data;
  }

  /**
   * Runs an in or out animation, kept so dispose can end it early; one still running is
   * finished at once first, so an out that comes during the in never tangles with it.
   */
  private async runPanelTimeline(timeline: QrCardTimeline, skipAnimation: boolean): Promise<void> {
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

/**
 * The logo bug OGraf graphic: one static image from the media store in the corner the item
 * picks, the smallest graphic in the catalogue (BAJAOVRLAY-63). This file owns the OGraf
 * lifecycle (load, play, update, stop, dispose) in the team card's shape and only wires
 * the pieces together: logoBugModel (data, defaults, limits), logoBugView (the DOM, drawn
 * by Lit), logoImageFetches (the logo on screen and the file on its way), playSteps (the
 * OGraf step rule) and logoBugAnimations (the fade).
 *
 * The image: load waits for it (loaded or failed, at most 2 s), and so does an update that
 * changes it, so play fades in a logo already drawn. A new file is fetched hidden while the
 * logo already on screen stays (a failure never blanks what is on air); it replaces that
 * logo once it has arrived. A file that fails answers 422 with a pt-BR message, which the
 * renderer passes on to the server, so the operator learns why: at load the corner is
 * empty, at an update the old logo is still up. A failed file is fetched again on the next
 * update, even at the same address (it may have finished uploading), and an update that
 * does not change the address answers 200 whatever that second try gives: it moved or
 * resized the logo as asked, and the operator was told about the file the first time. A
 * file still on its way after 2 s is not a failure: the call answers 200 and the image
 * appears when it arrives.
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
import {
  finishTimelineAtOnce,
  playTimelineToTheEnd,
} from '@bajaovrlay/graphics-kit/timelinePlayback';
import { LitElement } from 'lit';

import {
  buildFadeInTimeline,
  buildFadeOutTimeline,
  type LogoBugTimeline,
  placePanelOffAir,
} from './logoBugAnimations.js';
import {
  type LogoBugData,
  mergePartialUpdateIntoLogoBugData,
  parseCompleteLogoBugData,
  readLogoBugLook,
} from './logoBugModel.js';
import { logoBugStyles } from './logoBugStyles.js';
import { findLogoBugPanel, type LogoImageEvents, renderLogoBugTemplate } from './logoBugView.js';
import { LogoImageFetches } from './logoImageFetches.js';
import { ptBR } from './ptBR.js';

/** Must match "stepCount" in logo-bug.ograf.json: play shows the logo, stop hides it. */
const logoBugStepCount = 1;

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The logo bug graphic; the default export a renderer registers as a custom element. */
export default class LogoBugGraphic extends LitElement implements OGrafGraphic {
  static override styles = logoBugStyles;

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  // Read by render(); not Lit reactive properties, so the logo is redrawn only when this
  // file asks (redrawWithData or the image's own events), never by surprise.
  private data: LogoBugData | undefined = undefined;
  private panel: HTMLElement | undefined = undefined;
  private readonly images = new LogoImageFetches();
  // One motion at a time (in or out), so one timeline is all there is to end.
  private runningPanelTimeline: LogoBugTimeline | undefined = undefined;

  // An event from an image that is no longer the one on its way (a newer fetch replaced
  // it) changes nothing and draws nothing; logoImageFetches.ts tells.
  private readonly imageEvents: LogoImageEvents = {
    onImageLoaded: (fetchKey) => {
      if (this.images.markArrived(fetchKey)) {
        this.requestUpdate();
      }
    },
    onImageFailed: (fetchKey) => {
      if (this.images.markFailed(fetchKey)) {
        this.requestUpdate();
      }
    },
  };

  override render() {
    const look = this.data === undefined ? undefined : readLogoBugLook(this.data);
    return renderLogoBugTemplate(look, this.images.listImagesToDraw(), this.imageEvents);
  }

  /**
   * OGraf load: checks the data, draws it, waits for the image and leaves the logo off
   * air. A second load answers 409; bad data leaves it unloaded, so load can be tried
   * again. A failed image answers 422 and leaves it loaded but empty: an update with
   * another file can still fill it.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompleteLogoBugData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';

    // What could go wrong: a renderer calling load on an element not yet in the page
    // waits here until it is added, because Lit renders only connected elements.
    const imageSettles = this.images.startFetching(dataCheck.data.logoUrl);
    await this.redrawWithData(dataCheck.data);
    const panel = findLogoBugPanel(this.renderRoot);
    this.panel = panel;
    placePanelOffAir(panel);
    await this.images.waitForTheImageOnItsWay(imageSettles);

    // A dispose that came while load was waiting must win; going on would bring a
    // disposed graphic back to life.
    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    this.lifecycle = 'offAir';
    return this.answerForTheImage(dataCheck.data);
  }

  /** OGraf playAction: fades the logo in (step 0); a step past it means stop. */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: logoBugStepCount,
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
    // A stop during the fade in took the logo off again: report the step actually on air.
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    return { statusCode: 200, currentStep: target.step };
  }

  /** OGraf stopAction: fades the logo out and resolves once it is invisible. */
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
      buildFadeOutTimeline(this.requirePanel()),
      params.skipAnimation ?? false,
    );
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load, on air or off, and
   * redraws in place with no animation. A new image is waited for like load's, with the
   * old logo up meanwhile, and a failed one answers 422 with the old logo kept; a failed
   * image is tried again even at the same address. A new corner, height or opacity is
   * drawn at once.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoLogoBugData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }

    const isNewImage = dataCheck.data.logoUrl !== this.requireData().logoUrl;
    const isRetryOfAFailedImage = !isNewImage && this.images.hasTheWantedImageFailed();
    let imageSettles: Promise<void> | undefined = undefined;
    if (isNewImage || isRetryOfAFailedImage) {
      imageSettles = this.images.startFetching(dataCheck.data.logoUrl);
    }
    await this.redrawWithData(dataCheck.data);
    await this.images.waitForTheImageOnItsWay(imageSettles);
    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    // Deliberate: only an update that brought a new address answers for its image. One
    // that kept the address asked for a move or a size, which happened; the operator was
    // told about the file when it first failed.
    if (!isNewImage) {
      return okAnswer;
    }
    return this.answerForTheImage(dataCheck.data);
  }

  /** OGraf customAction: the logo bug has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /** OGraf dispose: ends a running fade and any wait for an image; pending actions resolve. */
  async dispose(): Promise<OGrafReturnPayload> {
    this.lifecycle = 'disposed';
    this.images.endAnyWait();
    const runningTimeline = this.runningPanelTimeline;
    this.runningPanelTimeline = undefined;
    if (runningTimeline !== undefined) {
      finishTimelineAtOnce(runningTimeline);
    }
    return okAnswer;
  }

  /** Keeps the data and waits until Lit has drawn it. */
  private async redrawWithData(data: LogoBugData): Promise<void> {
    this.data = data;
    this.requestUpdate();
    await this.updateComplete;
  }

  /**
   * 200, or 422 naming the address when the image failed: "fica vazio" when nothing is on
   * screen, "o logo anterior continua" when an older logo still is. The image's events
   * are drawn first.
   */
  private async answerForTheImage(data: LogoBugData): Promise<OGrafReturnPayload> {
    await this.updateComplete;
    if (!this.images.hasTheWantedImageFailed()) {
      return okAnswer;
    }
    if (!this.images.isALogoOnScreen()) {
      return buildRefusalAnswer(422, ptBR.actionProblems.imageDidNotLoad(data.logoUrl));
    }
    return buildRefusalAnswer(
      422,
      ptBR.actionProblems.imageDidNotLoadKeepingThePreviousLogo(data.logoUrl),
    );
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
      throw new Error('the logo bug panel is read only after load; this is a bug in logo-bug.ts');
    }
    return this.panel;
  }

  private requireData(): LogoBugData {
    if (this.data === undefined) {
      throw new Error('logo bug data is read only after load; this is a bug in logo-bug.ts');
    }
    return this.data;
  }

  /**
   * Runs a fade, kept so dispose can end it early; one still running is finished at once
   * first, so a fade out that comes during the fade in never tangles with it.
   */
  private async runPanelTimeline(timeline: LogoBugTimeline, skipAnimation: boolean): Promise<void> {
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

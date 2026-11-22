/**
 * The image OGraf graphic (BAJAOVRLAY-84): one image from the media store, at the width
 * (and optional height) the item gives, on one of nine anchors of the 1920x1080 canvas
 * moved by an X and a Y offset. This file owns the OGraf lifecycle (load, play, update,
 * stop, dispose) in the logo bug's shape and only wires the pieces together: imageModel
 * (data, defaults, limits), imageView (the DOM, drawn by Lit, placed by imageBoxPosition),
 * imageFileFetches (the picture on screen and the file on its way), playSteps (the OGraf
 * step rule) and imageAnimations (the fade).
 *
 * The file: load waits for it (loaded or failed, at most 2 s), and so does an update that
 * changes it, so play brings in a picture already drawn. A new file is fetched hidden
 * while the picture already on screen stays (a failure never blanks what is on air); it
 * replaces that picture once it has arrived. A file that fails answers 422 with a pt-BR
 * message, which the renderer passes on to the server, so the operator learns why: at
 * load nothing is drawn (never a broken-image icon), at an update the old picture stays
 * up. A failed file is fetched again on the next update, even at the same address, and an
 * update that does not change the address answers 200 whatever that second try gives: it
 * moved or resized the picture as asked, and the operator was told about the file the
 * first time. A file still on its way after 2 s is not a failure: the call answers 200 and
 * the picture appears when it arrives.
 *
 * The entrance: "fade" fades in over --motion-in and out over --motion-out; "none" cuts,
 * in and out, by playing the same timelines with skipAnimation. A new size or position on
 * air is drawn in place at once, with no entrance again.
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
  type ImageTimeline,
  placeBoxOffAir,
} from './imageAnimations.js';
import { ImageFileFetches } from './imageFileFetches.js';
import {
  type ImageData,
  mergePartialUpdateIntoImageData,
  parseCompleteImageData,
  readImageLook,
} from './imageModel.js';
import { imageStyles } from './imageStyles.js';
import { findImageBox, type ImageFileEvents, renderImageTemplate } from './imageView.js';
import { ptBR } from './ptBR.js';

/** Must match "stepCount" in image.ograf.json: play shows the picture, stop hides it. */
const imageStepCount = 1;

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The image graphic; the default export a renderer registers as a custom element. */
export default class ImageGraphic extends LitElement implements OGrafGraphic {
  static override styles = imageStyles;

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  // Read by render(); not Lit reactive properties, so the picture is redrawn only when this
  // file asks (redrawWithData or the image's own events), never by surprise.
  private data: ImageData | undefined = undefined;
  private box: HTMLElement | undefined = undefined;
  private readonly images = new ImageFileFetches();
  // One motion at a time (in or out), so one timeline is all there is to end.
  private runningBoxTimeline: ImageTimeline | undefined = undefined;

  // An event from an image that is no longer the one on its way (a newer fetch replaced
  // it) changes nothing and draws nothing; imageFileFetches.ts tells.
  private readonly imageEvents: ImageFileEvents = {
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
    const look = this.data === undefined ? undefined : readImageLook(this.data);
    return renderImageTemplate(look, this.images.listImagesToDraw(), this.imageEvents);
  }

  /**
   * OGraf load: checks the data, draws it, waits for the file and leaves the picture off
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
    const dataCheck = parseCompleteImageData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';

    // What could go wrong: a renderer calling load on an element not yet in the page
    // waits here until it is added, because Lit renders only connected elements.
    const imageSettles = this.images.startFetching(dataCheck.data.imageUrl);
    await this.redrawWithData(dataCheck.data);
    const box = findImageBox(this.renderRoot);
    this.box = box;
    placeBoxOffAir(box);
    await this.images.waitForTheImageOnItsWay(imageSettles);

    // A dispose that came while load was waiting must win; going on would bring a
    // disposed graphic back to life.
    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    this.lifecycle = 'offAir';
    return this.answerForTheImage(dataCheck.data);
  }

  /** OGraf playAction: brings the picture in (step 0), faded or cut; a step past it means stop. */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = this.shouldCutInsteadOfFading(params.skipAnimation);
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: imageStepCount,
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
    await this.runBoxTimeline(buildFadeInTimeline(this.requireBox()), skipAnimation);

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    // A stop during the fade in took the picture off again: report the step actually on air.
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    return { statusCode: 200, currentStep: target.step };
  }

  /** OGraf stopAction: takes the picture out, faded or cut, and resolves once it is invisible. */
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
    await this.runBoxTimeline(
      buildFadeOutTimeline(this.requireBox()),
      this.shouldCutInsteadOfFading(params.skipAnimation),
    );
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load, on air or off, and
   * redraws in place with no animation. A new file is waited for like load's, with the
   * old picture up meanwhile, and a failed one answers 422 with the old picture kept; a
   * failed file is tried again even at the same address. A new size, position, offset or
   * opacity moves the box in place at once, still on air, with no entrance again.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoImageData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }

    const isNewImage = dataCheck.data.imageUrl !== this.requireData().imageUrl;
    const isRetryOfAFailedImage = !isNewImage && this.images.hasTheWantedImageFailed();
    let imageSettles: Promise<void> | undefined = undefined;
    if (isNewImage || isRetryOfAFailedImage) {
      imageSettles = this.images.startFetching(dataCheck.data.imageUrl);
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

  /** OGraf customAction: the image graphic has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /** OGraf dispose: ends a running fade and any wait for an image; pending actions resolve. */
  async dispose(): Promise<OGrafReturnPayload> {
    this.lifecycle = 'disposed';
    this.images.endAnyWait();
    const runningTimeline = this.runningBoxTimeline;
    this.runningBoxTimeline = undefined;
    if (runningTimeline !== undefined) {
      finishTimelineAtOnce(runningTimeline);
    }
    return okAnswer;
  }

  /** Keeps the data and waits until Lit has drawn it. */
  private async redrawWithData(data: ImageData): Promise<void> {
    this.data = data;
    this.requestUpdate();
    await this.updateComplete;
  }

  /**
   * 200, or 422 naming the address when the file failed: "nada aparece" when nothing is
   * on screen, "a imagem anterior continua" when an older picture still is. The file's
   * events are drawn first.
   */
  private async answerForTheImage(data: ImageData): Promise<OGrafReturnPayload> {
    await this.updateComplete;
    if (!this.images.hasTheWantedImageFailed()) {
      return okAnswer;
    }
    if (!this.images.isAnImageOnScreen()) {
      return buildRefusalAnswer(422, ptBR.actionProblems.imageDidNotLoad(data.imageUrl));
    }
    return buildRefusalAnswer(
      422,
      ptBR.actionProblems.imageDidNotLoadKeepingThePreviousImage(data.imageUrl),
    );
  }

  /**
   * True when play or stop must cut rather than fade: the renderer asked to skip the
   * animation, or the item's entrance is "none".
   */
  private shouldCutInsteadOfFading(skipAnimationAsked: boolean | undefined): boolean {
    const isEntranceACut = readImageLook(this.requireData()).entrance === 'none';
    return (skipAnimationAsked ?? false) || isEntranceACut;
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

  private requireBox(): HTMLElement {
    if (this.box === undefined) {
      throw new Error('the image box is read only after load; this is a bug in image.ts');
    }
    return this.box;
  }

  private requireData(): ImageData {
    if (this.data === undefined) {
      throw new Error('image data is read only after load; this is a bug in image.ts');
    }
    return this.data;
  }

  /**
   * Runs a fade, kept so dispose can end it early; one still running is finished at once
   * first, so a fade out that comes during the fade in never tangles with it.
   */
  private async runBoxTimeline(timeline: ImageTimeline, skipAnimation: boolean): Promise<void> {
    if (this.runningBoxTimeline !== undefined) {
      finishTimelineAtOnce(this.runningBoxTimeline);
    }
    this.runningBoxTimeline = timeline;
    await playTimelineToTheEnd(timeline, { skipAnimation });
    if (this.runningBoxTimeline === timeline) {
      this.runningBoxTimeline = undefined;
    }
  }
}

/**
 * The team card OGraf graphic: the lower third's slot with the car as the subject, the big
 * chip, the team, the school and the city, with the car's photo at the left and the
 * team's logo at the right when the team has them. This file owns the OGraf lifecycle
 * (load, play, update, stop, dispose) in the notice's shape and only wires the pieces
 * together; the rules live in named modules: teamCardModel (data and cells), teamCardView
 * (the DOM, drawn by Lit from the data), playSteps (the OGraf step rule),
 * teamCardAnimations (GSAP timelines from the theme's motion tokens) and
 * waitForImagesToSettle (load's wait for the photo and the logo).
 *
 * Load waits for the theme's face and for the card's images (loaded or failed, at most
 * 2 s), so play brings the card in with its photo and logo already drawn. An update on
 * air does not wait: a new logo appears when it arrives, and the card never waits off air
 * for an image.
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
import { waitForThemeFontsToBeReady } from '@bajaovrlay/theme/fonts';
import { LitElement } from 'lit';

import { ptBR } from './ptBR.js';
import {
  buildPlayInTimeline,
  buildStopOutTimeline,
  placePanelOffAir,
  type TeamCardTimeline,
} from './teamCardAnimations.js';
import {
  mergePartialUpdateIntoTeamCardData,
  parseCompleteTeamCardData,
  type TeamCardData,
} from './teamCardModel.js';
import { teamCardStyles } from './teamCardStyles.js';
import { findTeamCardPanel, renderTeamCardTemplate } from './teamCardView.js';
import { waitForImagesToSettle } from './waitForImagesToSettle.js';

/** Must match "stepCount" in team-card.ograf.json: play shows the card, stop hides it. */
const teamCardStepCount = 1;

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The team card graphic; the default export a renderer registers as a custom element. */
export default class TeamCardGraphic extends LitElement implements OGrafGraphic {
  static override styles = teamCardStyles;

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  // Read by render(); not a Lit reactive property, so the card is redrawn only when this
  // file asks (redrawWithData), never by surprise.
  private data: TeamCardData | undefined = undefined;
  private panel: HTMLElement | undefined = undefined;
  // The card has one motion at a time (in or out), so one timeline is all there is to end.
  private runningPanelTimeline: TeamCardTimeline | undefined = undefined;

  override render() {
    return renderTeamCardTemplate(this.data);
  }

  /**
   * OGraf load: checks the data, draws it, waits for the theme's font and the card's
   * images, and leaves the card off air. A graphic is loaded once; a second load answers
   * 409 rather than half resetting one that may be on air. Bad data leaves it unloaded,
   * so load can be tried again.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompleteTeamCardData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';

    // What could go wrong: a renderer calling load on an element not yet in the page
    // waits here until it is added, because Lit renders only connected elements.
    await this.redrawWithData(dataCheck.data);
    const panel = findTeamCardPanel(this.renderRoot);
    this.panel = panel;
    placePanelOffAir({ panel });
    // The element itself is where the face's token is read: custom properties reach
    // inside the shadow root, so the wait follows the theme on the page.
    await waitForThemeFontsToBeReady(this);
    await waitForImagesToSettle(this.renderRoot);

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
   * on air until stopAction.
   */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: teamCardStepCount,
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
    await this.runPanelTimeline(buildPlayInTimeline({ panel: this.requirePanel() }), skipAnimation);

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    // A stop during the play-in took the card off again: report the step actually on
    // air (none), so a renderer tracking steps from this answer stays in step.
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    return { statusCode: 200, currentStep: target.step };
  }

  /** OGraf stopAction: animates the card out and resolves once it is off screen. */
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
      buildStopOutTimeline({ panel: this.requirePanel() }),
      params.skipAnimation ?? false,
    );
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load, on air or off,
   * and redraws the card in place with no animation (a logo that comes or goes changes
   * the card's width at once). Refused only before load and after dispose.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoTeamCardData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }

    await this.redrawWithData(dataCheck.data);
    return okAnswer;
  }

  /** OGraf customAction: the team card has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /**
   * OGraf dispose: ends every timeline; pending actions resolve. OGraf passes an empty
   * params object, which the card has no use for.
   */
  async dispose(): Promise<OGrafReturnPayload> {
    this.lifecycle = 'disposed';
    const runningTimeline = this.runningPanelTimeline;
    this.runningPanelTimeline = undefined;
    if (runningTimeline !== undefined) {
      finishTimelineAtOnce(runningTimeline);
    }
    return okAnswer;
  }

  /** Keeps the data and waits until Lit has drawn it. */
  private async redrawWithData(data: TeamCardData): Promise<void> {
    this.data = data;
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
      throw new Error(
        'the team card element is read only after load; this is a bug in team-card.ts',
      );
    }
    return this.panel;
  }

  private requireData(): TeamCardData {
    if (this.data === undefined) {
      throw new Error('team card data is read only after load; this is a bug in team-card.ts');
    }
    return this.data;
  }

  /**
   * Runs an in or out animation, kept so dispose can end it early; one still running is
   * finished at once first, so an out that comes during the in never tangles with it.
   */
  private async runPanelTimeline(
    timeline: TeamCardTimeline,
    skipAnimation: boolean,
  ): Promise<void> {
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

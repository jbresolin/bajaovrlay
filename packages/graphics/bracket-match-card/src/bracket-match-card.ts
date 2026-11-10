/**
 * The "a seguir" card OGraf graphic (BAJAOVRLAY-65): the Super Prime's next match, larger
 * than the match bug, on the lower third: "A SEGUIR", the round, and each side's logo (or
 * its car-number chip), team, school and city, with the score once the match has started.
 * This file owns the OGraf lifecycle (load, play, update, stop, dispose) in the team
 * card's shape and only wires the pieces together: matchCardModel (data and what it
 * shows), matchCardView (the DOM, drawn by Lit), playSteps (the OGraf step rule),
 * matchCardAnimations (the team card's rise), the kit's waitForImagesToSettle (load's
 * wait for the logos) and the kit's scrolling texts.
 *
 * Load waits for the theme's face and for the logos (loaded or failed, at most 2 s), so
 * play brings the card in with its logos drawn. An update on air does not wait: a new
 * logo appears when it arrives. When "a seguir" is emptied every field leaves the air and
 * the card, still on air, shows nothing; it never keeps a stale match.
 *
 * The renderer, not this module, picks the tag name and calls customElements.define, as
 * OGraf v1 expects of a graphic's default export.
 */
import { carChipLargeStyles } from '@bajaovrlay/graphics-kit/carChipLargeStyles';
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
import { teamLogoCellStyles } from '@bajaovrlay/graphics-kit/teamLogoCellStyles';
import {
  finishTimelineAtOnce,
  playTimelineToTheEnd,
} from '@bajaovrlay/graphics-kit/timelinePlayback';
import { waitForImagesToSettle } from '@bajaovrlay/graphics-kit/waitForImagesToSettle';
import { waitForThemeFontsToBeReady } from '@bajaovrlay/theme/fonts';
import { LitElement } from 'lit';

import {
  buildPlayInTimeline,
  buildStopOutTimeline,
  type MatchCardTimeline,
  placePanelOffAir,
} from './matchCardAnimations.js';
import {
  type MatchCardData,
  mergePartialUpdateIntoMatchCardData,
  parseCompleteMatchCardData,
  readMatchCardLook,
} from './matchCardModel.js';
import { matchCardStyles } from './matchCardStyles.js';
import { findMatchCardPanel, renderMatchCardTemplate } from './matchCardView.js';
import { ptBR } from './ptBR.js';

/** Must match "stepCount" in bracket-match-card.ograf.json: play shows the card, stop hides it. */
const matchCardStepCount = 1;

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The "a seguir" card graphic; the default export a renderer registers as a custom element. */
export default class BracketMatchCardGraphic extends LitElement implements OGrafGraphic {
  static override styles = [
    scrollingTextStyles,
    teamLogoCellStyles,
    carChipLargeStyles,
    matchCardStyles,
  ];

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  // Read by render(); not a Lit reactive property, so the card is redrawn only when this
  // file asks (redrawWithData), never by surprise.
  private data: MatchCardData | undefined = undefined;
  private panel: HTMLElement | undefined = undefined;
  // One motion at a time (in or out), so one timeline is all there is to end.
  private runningPanelTimeline: MatchCardTimeline | undefined = undefined;
  /** The cycle of the names too long for their box; made at load, once Lit has rendered. */
  private scrollingTextClock: ScrollingTextClock | undefined = undefined;
  /**
   * The logo addresses that failed to load: their side shows the car chip. Kept for the
   * element's life, so a broken address sent again by an update is not retried; a new
   * address (the team's logo replaced in Cadastros) is.
   */
  private readonly failedLogoUrls = new Set<string>();

  override render() {
    const look = this.data === undefined ? undefined : readMatchCardLook(this.data);
    return renderMatchCardTemplate(look, {
      failedLogoUrls: this.failedLogoUrls,
      onLogoFailed: (logoUrl) => {
        this.failedLogoUrls.add(logoUrl);
        this.requestUpdate();
      },
    });
  }

  /**
   * OGraf load: checks the data, draws it, waits for the theme's face and the logos, and
   * leaves the card off air. Empty data is good data (an empty "a seguir"): the card loads
   * and shows nothing. A second load answers 409; bad data leaves it unloaded, so load can
   * be tried again.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompleteMatchCardData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';

    // What could go wrong: a renderer calling load on an element not yet in the page
    // waits here until it is added, because Lit renders only connected elements.
    await this.redrawWithData(dataCheck.data);
    const panel = findMatchCardPanel(this.renderRoot);
    this.panel = panel;
    this.scrollingTextClock = createScrollingTextClock({
      root: this.renderRoot,
      tokensSource: this,
    });
    placePanelOffAir({ panel });
    await waitForThemeFontsToBeReady(this);
    await waitForImagesToSettle(this.renderRoot);
    // A logo that failed has asked for a redraw with its car chip: draw it before play.
    await this.updateComplete;

    // A dispose that came while load was waiting must win; going on would bring a
    // disposed graphic back to life.
    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    this.lifecycle = 'offAir';
    return okAnswer;
  }

  /** OGraf playAction: brings the card in (step 0); a step past it means stop. */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: matchCardStepCount,
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
    // A stop during the play-in took the card off again: report the step actually on air.
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    this.scrollingTextClock?.start();
    return { statusCode: 200, currentStep: target.step };
  }

  /** OGraf stopAction: takes the card out and resolves once it is off screen. */
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
      buildStopOutTimeline({ panel: this.requirePanel() }),
      params.skipAnimation ?? false,
    );
    this.scrollingTextClock?.stopAfterThePlayOut();
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load, on air or off, and
   * redraws in place with no animation: another match "a seguir", a logo, a result, or the
   * match leaving the air (its fields sent as undefined), after which the card shows
   * nothing. A new logo is not waited for. Refused only before load, after dispose, and
   * for bad data.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoMatchCardData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    await this.redrawWithData(dataCheck.data);
    return okAnswer;
  }

  /**
   * Lit's hook for the element leaving the page: the scrolling texts' cycle stops, so a
   * layer a renderer removed without dispose leaves no animation running inside OBS.
   */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.scrollingTextClock?.stop();
  }

  /** OGraf customAction: the card has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /** OGraf dispose: ends a running motion and the scrolling texts; pending actions resolve. */
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
  private async redrawWithData(data: MatchCardData): Promise<void> {
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
        'the card panel is read only after load; this is a bug in bracket-match-card.ts',
      );
    }
    return this.panel;
  }

  private requireData(): MatchCardData {
    if (this.data === undefined) {
      throw new Error('card data is read only after load; this is a bug in bracket-match-card.ts');
    }
    return this.data;
  }

  /**
   * Runs a motion, kept so dispose can end it early; one still running is finished at once
   * first, so a stop that comes during the play-in never tangles with it.
   */
  private async runPanelTimeline(
    timeline: MatchCardTimeline,
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

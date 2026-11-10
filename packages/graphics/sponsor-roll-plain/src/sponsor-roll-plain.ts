/**
 * The plain sponsor roll OGraf graphic (BAJAOVRLAY-64): every sponsor once, one at a time,
 * its logo under its level's heading on the theme's card, in the corner the item picks.
 * This file owns the OGraf lifecycle (load, play, update, stop, dispose) in the team card's
 * shape and the turns of the one pass, and wires the pieces together:
 * sponsorRollPlainModel (data, corner, the pass), sponsorRollPlainView (the DOM, drawn by
 * Lit), playSteps (the OGraf step rule) and sponsorRollPlainAnimations (the fades).
 *
 * One pass, then out: play shows the first sponsor and turns to each next one when the
 * plan says, counted from the play, on shared's table (sponsorRollPass.ts). After the last
 * sponsor's hold nothing turns: the server, which worked out the same pass from the same
 * table, takes the roll off air then (its auto-out), so the graphic never loops and never
 * leaves by itself. If the clear came late, the last sponsor stays up, never an empty card.
 *
 * Deliberate: an update on air with a new sponsor list changes the data but not the pass
 * running, because the server's auto-out was fixed at the take; the next play shows the new
 * list. A new corner moves the card at once.
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
import { waitForImagesToSettle } from '@bajaovrlay/graphics-kit/waitForImagesToSettle';
import { waitForThemeFontsToBeReady } from '@bajaovrlay/theme/fonts';
import { LitElement } from 'lit';

import { ptBR } from './ptBR.js';
import {
  buildCardFadeInTimeline,
  buildCardFadeOutTimeline,
  buildSponsorTurnTimeline,
  placeCardOffAir,
  type PlainRollTimeline,
  showOnlyTheCellAt,
} from './sponsorRollPlainAnimations.js';
import {
  mergePartialUpdateIntoSponsorRollPlainData,
  parseCompleteSponsorRollPlainData,
  planThePassOfTheRoll,
  type SponsorRollPlainData,
  type SponsorRollPlainPass,
} from './sponsorRollPlainModel.js';
import { sponsorRollPlainStyles } from './sponsorRollPlainStyles.js';
import {
  findPlainRollCard,
  findSponsorCells,
  renderSponsorRollPlainTemplate,
} from './sponsorRollPlainView.js';

/** Must match "stepCount" in sponsor-roll-plain.ograf.json: play shows the pass, stop ends it. */
const plainRollStepCount = 1;

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The plain sponsor roll graphic; the default export a renderer registers as a custom element. */
export default class SponsorRollPlainGraphic extends LitElement implements OGrafGraphic {
  static override styles = sponsorRollPlainStyles;

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  // Read by render(); not Lit reactive properties, so the card is redrawn only when this
  // file asks, never by surprise.
  private data: SponsorRollPlainData | undefined = undefined;
  private pass: SponsorRollPlainPass | undefined = undefined;
  // The turns of the pass on air, started at play; called off at stop and dispose.
  private turnTimers: Array<ReturnType<typeof setTimeout>> = [];
  // One card motion at a time (in or out), and one turn at a time.
  private runningCardTimeline: PlainRollTimeline | undefined = undefined;
  private runningTurnTimeline: PlainRollTimeline | undefined = undefined;

  override render() {
    return renderSponsorRollPlainTemplate(this.data, this.pass);
  }

  /**
   * OGraf load: checks the data, plans the pass, draws every sponsor of it and waits for the
   * theme's fonts and every logo, leaving the card off air on the first sponsor. A second
   * load answers 409; bad data (400) and a list with no logo to show (422) leave it
   * unloaded, so load can be tried again.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompleteSponsorRollPlainData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    const pass = planThePassOfTheRoll(dataCheck.data);
    if (pass.sponsorsShown.length === 0) {
      return buildRefusalAnswer(422, ptBR.actionProblems.noSponsorWithALogo);
    }
    this.lifecycle = 'loading';

    // What could go wrong: a renderer calling load on an element not yet in the page
    // waits here until it is added, because Lit renders only connected elements.
    await this.redrawWith(dataCheck.data, pass);
    placeCardOffAir(findPlainRollCard(this.renderRoot));
    showOnlyTheCellAt(findSponsorCells(this.renderRoot), 0);
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

  /** OGraf playAction: fades the card in on the first sponsor and starts the pass (step 0). */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: plainRollStepCount,
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
    showOnlyTheCellAt(findSponsorCells(this.renderRoot), 0);
    // The turns count from this moment, as the server's auto-out counts from the take.
    this.startTheTurnsOfThePass();
    await this.runCardTimeline(buildCardFadeInTimeline(this.requireCard()), skipAnimation);

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    // A stop during the fade in took the card off again: report the step actually on air.
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    return { statusCode: 200, currentStep: target.step };
  }

  /**
   * OGraf stopAction: calls the turns off, fades the card out and resolves once it is
   * invisible. A sponsor list updated on air is planned then, for the next play.
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
    this.callTheTurnsOff();
    await this.runCardTimeline(
      buildCardFadeOutTimeline(this.requireCard()),
      params.skipAnimation ?? false,
    );
    if (this.readLifecycleNow() === 'offAir') {
      const data = this.requireData();
      await this.redrawWith(data, planThePassOfTheRoll(data));
      showOnlyTheCellAt(findSponsorCells(this.renderRoot), 0);
    }
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load and redraws in place
   * with no animation. On air the pass running is kept (the server's auto-out was fixed at
   * the take) and only the corner moves; off air the pass is planned again and its logos
   * waited for. A list with no logo to show is refused with 422 and changes nothing.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoSponsorRollPlainData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    const passOfTheNewData = planThePassOfTheRoll(dataCheck.data);
    if (passOfTheNewData.sponsorsShown.length === 0) {
      return buildRefusalAnswer(422, ptBR.actionProblems.noSponsorWithALogo);
    }

    if (this.lifecycle === 'onAir') {
      await this.redrawWith(dataCheck.data, this.requirePass());
      return okAnswer;
    }
    await this.redrawWith(dataCheck.data, passOfTheNewData);
    showOnlyTheCellAt(findSponsorCells(this.renderRoot), 0);
    await waitForImagesToSettle(this.renderRoot);
    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    return okAnswer;
  }

  /** OGraf customAction: the plain roll has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /** OGraf dispose: calls the turns off and ends any running motion; pending actions resolve. */
  async dispose(): Promise<OGrafReturnPayload> {
    this.lifecycle = 'disposed';
    this.callTheTurnsOff();
    const runningCardTimeline = this.runningCardTimeline;
    this.runningCardTimeline = undefined;
    if (runningCardTimeline !== undefined) {
      finishTimelineAtOnce(runningCardTimeline);
    }
    return okAnswer;
  }

  /**
   * Starts one timer per turn of the pass: when a sponsor's hold ends, the next one comes.
   * The last sponsor's hold ends the pass, so it has no turn: the server's clear comes then.
   */
  private startTheTurnsOfThePass(): void {
    this.callTheTurnsOff();
    const sponsorsShown = this.requirePass().sponsorsShown;
    for (let nextIndex = 1; nextIndex < sponsorsShown.length; nextIndex += 1) {
      const holdBefore = sponsorsShown[nextIndex - 1];
      if (holdBefore === undefined) {
        continue;
      }
      const turnTimer = setTimeout(() => {
        void this.turnToTheSponsorAt(nextIndex);
      }, holdBefore.holdEndsAtMs);
      this.turnTimers.push(turnTimer);
    }
  }

  /** Calls every pending turn off and ends a turn half done, the next cell shown at once. */
  private callTheTurnsOff(): void {
    for (const turnTimer of this.turnTimers) {
      clearTimeout(turnTimer);
    }
    this.turnTimers = [];
    const runningTurnTimeline = this.runningTurnTimeline;
    this.runningTurnTimeline = undefined;
    if (runningTurnTimeline !== undefined) {
      finishTimelineAtOnce(runningTurnTimeline);
    }
  }

  /** Cross-fades from the sponsor on air to the one at `nextIndex`. */
  private async turnToTheSponsorAt(nextIndex: number): Promise<void> {
    if (this.lifecycle !== 'onAir') {
      return;
    }
    const cells = findSponsorCells(this.renderRoot);
    const cellOnAir = cells[nextIndex - 1];
    const nextCell = cells[nextIndex];
    if (cellOnAir === undefined || nextCell === undefined) {
      return;
    }
    if (this.runningTurnTimeline !== undefined) {
      finishTimelineAtOnce(this.runningTurnTimeline);
    }
    const turnTimeline = buildSponsorTurnTimeline(this.requireCard(), cellOnAir, nextCell);
    this.runningTurnTimeline = turnTimeline;
    await playTimelineToTheEnd(turnTimeline, { skipAnimation: false });
    if (this.runningTurnTimeline === turnTimeline) {
      this.runningTurnTimeline = undefined;
    }
  }

  /** Keeps the data and the pass, and waits until Lit has drawn them. */
  private async redrawWith(data: SponsorRollPlainData, pass: SponsorRollPlainPass): Promise<void> {
    this.data = data;
    this.pass = pass;
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

  private requireCard(): HTMLElement {
    return findPlainRollCard(this.renderRoot);
  }

  private requireData(): SponsorRollPlainData {
    if (this.data === undefined) {
      throw new Error('plain roll data is read only after load; this is a bug');
    }
    return this.data;
  }

  private requirePass(): SponsorRollPlainPass {
    if (this.pass === undefined) {
      throw new Error('the plain roll pass is read only after load; this is a bug');
    }
    return this.pass;
  }

  /**
   * Runs a card fade, kept so dispose can end it early; one still running is finished at
   * once first, so a fade out that comes during the fade in never tangles with it.
   */
  private async runCardTimeline(
    timeline: PlainRollTimeline,
    skipAnimation: boolean,
  ): Promise<void> {
    if (this.runningCardTimeline !== undefined) {
      finishTimelineAtOnce(this.runningCardTimeline);
    }
    this.runningCardTimeline = timeline;
    await playTimelineToTheEnd(timeline, { skipAnimation });
    if (this.runningCardTimeline === timeline) {
      this.runningCardTimeline = undefined;
    }
  }
}

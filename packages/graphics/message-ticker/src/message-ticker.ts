/**
 * The message ticker OGraf graphic: the strip's bar with the clock block (when shown), an
 * "AVISO" label pill, one announcement a page and the page cell ("1/3"), on the ticker
 * layer: the lower strip with a message in place of the cars. This file owns the OGraf
 * lifecycle, the motion and the two timers, and wires messageTickerModel (data, within
 * messageLimits), messageTickerPageTurns (the message on air, a turn and what arrived
 * during it), messageTickerView (the DOM, written in place) and the kit's clock block on a
 * bar (frame loop, redraw, switch), motion runner, barMotion, pageTurner, pageHold and
 * playSteps.
 * Messages page every `--motion-strip-hold` and never scroll; the clock block is redrawn
 * every frame on air with the server-aligned "now".
 *
 * The renderer, not this module, picks the tag name and calls customElements.define, as
 * OGraf v1 expects of a graphic's default export.
 */
import {
  buildBarPlayInTimeline,
  buildBarStopOutTimeline,
  placeBarPiecesOffAir,
} from '@bajaovrlay/graphics-kit/barMotion';
import {
  type ClockBlockOnBar,
  createClockBlockOnBar,
  readClockReadingFrom,
} from '@bajaovrlay/graphics-kit/clockBlockOnBar';
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
import {
  readHoldMsOrFallback,
  stripHoldMsWhenTokenMissing,
} from '@bajaovrlay/graphics-kit/pageHold';
import { createPageTurner, type PageTurner } from '@bajaovrlay/graphics-kit/pageTurner';
import { choosePlayActionTarget } from '@bajaovrlay/graphics-kit/playSteps';
import { waitForThemeFontsToBeReady } from '@bajaovrlay/theme/fonts';
import { LitElement } from 'lit';

import {
  isClockBlockShown,
  mergePartialUpdateIntoMessageTickerData,
  type MessageTickerData,
  parseCompleteMessageTickerData,
} from './messageTickerModel.js';
import { MessageTickerPageTurns } from './messageTickerPageTurns.js';
import { messageTickerStyles } from './messageTickerStyles.js';
import {
  findMessageTickerParts,
  type MessageTickerParts,
  renderMessageTickerTemplate,
  writeLabel,
} from './messageTickerView.js';
import { ptBR } from './ptBR.js';

/** Must match "stepCount" in message-ticker.ograf.json: play shows the ticker, stop hides it. */
const messageTickerStepCount = 1;

type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

const okAnswer: OGrafReturnPayload = { statusCode: 200 };

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The message ticker graphic; the default export a renderer registers as a custom element. */
export default class MessageTickerGraphic extends LitElement implements OGrafGraphic {
  static override styles = messageTickerStyles;

  private lifecycle: LifecycleStage = 'unloaded';
  private currentStep: number | undefined = undefined;
  private data: MessageTickerData | undefined = undefined;
  private parts: MessageTickerParts | undefined = undefined;
  private readonly motionRunner: MotionTimelineRunner = createMotionTimelineRunner();
  private readonly pageTurner: PageTurner = createPageTurner({
    onTurn: () => this.turnToTheNextPageNow(),
    readHoldMs: () => readHoldMsOrFallback(this, 'stripHoldMs', stripHoldMsWhenTokenMissing),
    setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimer: (timerId) => window.clearTimeout(timerId),
  });
  private readonly clockBlockOnBar: ClockBlockOnBar = createClockBlockOnBar({
    readBar: () => this.parts?.bar,
    readClockBlock: () => this.parts?.clockBlock,
    readReading: () => (this.data === undefined ? undefined : readClockReadingFrom(this.data)),
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (frameId) => cancelAnimationFrame(frameId),
  });
  private readonly pageTurns = new MessageTickerPageTurns({
    isOnAir: () => this.lifecycle === 'onAir',
    isOffAir: () => this.lifecycle === 'offAir',
    isMotionRunning: () => this.motionRunner.isRunning(),
    readParts: () => this.requireParts(),
    readData: () => this.requireData(),
    runMotionTimeline: (timeline) => this.motionRunner.run(timeline, false),
  });

  override render() {
    return renderMessageTickerTemplate();
  }

  /**
   * OGraf load: checks the data, waits for the first render and the theme's font, draws
   * the first message, the label and the clock block off air. Loaded once; a second load answers 409. Bad data
   * leaves it unloaded, so load can be tried again.
   */
  async load(params: OGrafLoadParams): Promise<OGrafReturnPayload> {
    if (this.lifecycle === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    if (this.lifecycle !== 'unloaded') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
    }
    const dataCheck = parseCompleteMessageTickerData(params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }
    this.lifecycle = 'loading';

    // What could go wrong: a renderer calling load on an element not yet in the page
    // waits here until it is added, because Lit renders only connected elements.
    await this.updateComplete;
    await waitForThemeFontsToBeReady(this);
    // A dispose that came while load was waiting must win.
    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }

    const parts = findMessageTickerParts(this.renderRoot);
    this.parts = parts;
    this.data = dataCheck.data;
    this.clockBlockOnBar.writeSwitch(isClockBlockShown(dataCheck.data), false);
    writeLabel(parts, dataCheck.data.label);
    this.clockBlockOnBar.redraw();
    placeBarPiecesOffAir(parts.bar, [
      parts.clockBlock.block,
      parts.labelPill,
      ...parts.messagePills,
      parts.pageCell,
    ]);
    this.pageTurns.drawCurrentPage();
    this.lifecycle = 'offAir';
    return okAnswer;
  }

  /** OGraf playAction: animates the ticker in (step 0); a step past it means stop. */
  async playAction(params: OGrafPlayActionParams): Promise<OGrafPlayActionReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const skipAnimation = params.skipAnimation ?? false;
    const target = choosePlayActionTarget({
      currentStep: this.currentStep,
      stepCount: messageTickerStepCount,
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
    this.clockBlockOnBar.redraw();
    this.clockBlockOnBar.startTicking();
    const parts = this.requireParts();
    const playIn = buildBarPlayInTimeline(parts.bar, this.listPiecesInOrder());
    await this.motionRunner.run(playIn, skipAnimation);

    if (this.readLifecycleNow() === 'disposed') {
      return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
    }
    // A stop during the play-in took the ticker off again: report no step on air.
    if (this.readLifecycleNow() !== 'onAir') {
      return { statusCode: 200, currentStep: this.currentStep };
    }
    this.startPageTurnerWhenThereArePages();
    return { statusCode: 200, currentStep: target.step };
  }

  /**
   * OGraf stopAction: stops the page timer, animates every piece out together, resolves
   * once off screen, stops the clock's frame loop and leaves the first message drawn off
   * air.
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
    this.pageTurner.stop();
    const parts = this.requireParts();
    // Both message pills: a turn the stop cut short may leave either visible.
    const everyPiece = [
      parts.clockBlock.block,
      parts.labelPill,
      ...parts.messagePills,
      parts.pageCell,
    ];
    const stopOut = buildBarStopOutTimeline(parts.bar, everyPiece);
    await this.motionRunner.run(stopOut, params.skipAnimation ?? false);
    // A play may have arrived during the out animation; only then keep the clock ticking.
    if (this.readLifecycleNow() !== 'onAir') {
      this.clockBlockOnBar.stopTicking();
    }
    this.pageTurns.restOnTheFirstMessageOnceSettledOffAir();
    return okAnswer;
  }

  /**
   * OGraf updateAction: merges partial data in at any time after load ("Atualizar no ar"
   * sends a new list of messages, the clock group a new reading). On air the message, the
   * label and the page cell are written in place and the clock block at once, with no
   * re-entry; off air they are simply drawn, ready for play. During a page turn or the
   * stop-out the messages are stored and drawn once that motion has ended.
   */
  async updateAction(params: OGrafUpdateActionParams): Promise<OGrafReturnPayload> {
    const refusal = this.refuseUnlessLoaded();
    if (refusal !== undefined) {
      return refusal;
    }
    const dataCheck = mergePartialUpdateIntoMessageTickerData(this.requireData(), params.data);
    if (!dataCheck.isValid) {
      return buildRefusalAnswer(400, dataCheck.problem);
    }

    this.data = dataCheck.data;
    this.clockBlockOnBar.writeSwitch(isClockBlockShown(dataCheck.data), this.lifecycle === 'onAir');
    writeLabel(this.requireParts(), dataCheck.data.label);
    this.clockBlockOnBar.redraw();
    this.pageTurns.drawUpdatedData();
    // A ticker taken with one message and given a second must start turning; starting a
    // running timer does nothing.
    this.startPageTurnerWhenThereArePages();
    return okAnswer;
  }

  /**
   * Lit's hook for the element leaving the page: the page timer and the clock's frame loop
   * stop, so a layer a renderer removed without dispose never goes on turning pages or
   * drawing frames. Not restarted if the element comes back: a renderer loads a new
   * element for a new layer.
   */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.pageTurner.stop();
    this.clockBlockOnBar.stopTicking();
  }

  /** OGraf customAction: the message ticker has none, so every id is unknown. */
  async customAction(params: OGrafCustomActionParams): Promise<OGrafReturnPayload> {
    return buildRefusalAnswer(404, ptBR.actionProblems.unknownCustomAction(params.id));
  }

  /**
   * OGraf dispose: stops the page timer and the frame loop and ends every timeline;
   * pending actions resolve.
   */
  async dispose(): Promise<OGrafReturnPayload> {
    this.lifecycle = 'disposed';
    this.pageTurner.stop();
    this.clockBlockOnBar.stopTicking();
    this.motionRunner.finishEveryTimelineAtOnce();
    return okAnswer;
  }

  /**
   * Turns to the next page now: what the page timer calls after its hold, and what the
   * preview's "Próximo aviso" button and the tests call (not an OGraf action). Nothing
   * happens before load, off air (the ticker rests on its first message for the next
   * take), during another turn, or with a single message.
   */
  async turnToTheNextPageNow(): Promise<void> {
    if (this.lifecycle !== 'onAir') {
      return;
    }
    await this.pageTurns.turnToTheNextPage();
  }

  /**
   * The pieces of the play-in, left to right: the clock block when shown, the label, the
   * message on air, the page cell.
   */
  private listPiecesInOrder(): HTMLElement[] {
    const parts = this.requireParts();
    const clockBlockPieces = isClockBlockShown(this.requireData()) ? [parts.clockBlock.block] : [];
    return [
      ...clockBlockPieces,
      parts.labelPill,
      this.pageTurns.readMessagePillOnAir(),
      parts.pageCell,
    ];
  }

  /** Starts the page timer, only on air and with more than one page. */
  private startPageTurnerWhenThereArePages(): void {
    if (this.lifecycle === 'onAir' && this.pageTurns.countPages() > 1) {
      this.pageTurner.start();
    }
  }

  /** Reads the lifecycle after an await, which stop or dispose may have changed meanwhile. */
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

  private requireParts(): MessageTickerParts {
    if (this.parts === undefined) {
      throw new Error('the parts are found only at load; a bug in message-ticker.ts');
    }
    return this.parts;
  }

  private requireData(): MessageTickerData {
    if (this.data === undefined) {
      throw new Error('data is read only after load; a bug in message-ticker.ts');
    }
    return this.data;
  }
}

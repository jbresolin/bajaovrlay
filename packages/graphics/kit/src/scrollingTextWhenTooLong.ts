/**
 * Long text scrolls inside its box (BAJAOVRLAY-55): the kit part every graphic uses for a
 * text that can be too long (a team, a school, a person, a session, the event line). An
 * ellipsis is no longer used on air.
 *
 * A box is any element of the graphic marked `scrolling-text-box`, holding one
 * `scrolling-text` element with the text: made with makeScrollingTextBox (a graphic that
 * writes its own DOM) or renderScrollingText (a Lit template). The box clips; the text
 * inside is one line, as wide as it needs (scrollingTextStyles.ts).
 *
 * One clock per graphic, over its shadow root, started on air and stopped off air. At each
 * cycle start it finds every box, measures it and plans the cycle (scrollingTextCycle.ts);
 * each text too long gets one Web Animation over the whole cycle (scrollingTextKeyframes.ts),
 * all started in the same moment, and one timer begins the next cycle, so every text of the
 * graphic starts and restarts together. Only `transform` and `opacity` move, which Chromium
 * runs on its compositor thread: the scroll keeps its frames when OBS's page is busy, which
 * a GSAP timeline (writing the transform from the main thread) did not. Timers name each
 * box's phase (`data-scroll-phase`), which turns its edge fade on and off and which the
 * tests wait on. Texts that fit are not touched. A MutationObserver sees a text change and
 * a ResizeObserver a box resize: the text goes back to its start at once (its box keeps its
 * width) and joins at the next cycle start; with no cycle running, one starts.
 *
 * What could go wrong: the observers, the timers and the animations would keep a stopped
 * graphic busy inside OBS; stop disconnects, clears and cancels them all, and every graphic
 * stops its clock on stop, dispose and when it leaves the page.
 */
import { html, type TemplateResult } from 'lit';

import {
  leaveTextOutOfTheCycle,
  measureScrollDistancePx,
  planScrollingTextCycle,
  readPhaseMomentsOfText,
  type ScrollingTextCycle,
  type ScrollingTextMeasure,
  type ScrollingTextPhaseName,
} from './scrollingTextCycle.js';
import { buildScrollingTextKeyframes } from './scrollingTextKeyframes.js';
import { readScrollingTextTimings, type ScrollingTextTimings } from './scrollingTextTimings.js';
import { writeTextIfChanged } from './textInPlace.js';

/** The class that marks a clipped box; the clock finds the boxes by it. */
const boxClassName = 'scrolling-text-box';
/** The class of the one text element inside a box, the element that moves. */
const textClassName = 'scrolling-text';

/**
 * How every scrolling text animation's `id` begins, followed by the cycle's number: the
 * animations of one cycle share an id, so a test (scrollingTextOnAir.testSupport.ts) or a
 * look in the browser's animation panel tells the cycles apart from a graphic's motions.
 */
export const scrollingTextCycleIdPrefix = 'scrollingTextCycle-';

/** What a graphic gives its clock. */
export type ScrollingTextClockOptions = {
  /** The graphic's shadow root: every box inside it shares the clock. */
  root: ParentNode & Node;
  /** The element the theme's `--motion-text-*` tokens are read from (the graphic itself). */
  tokensSource: Element;
};

/** The clock of a graphic's scrolling texts. */
export type ScrollingTextClock = {
  /** Starts the cycles (the graphic is on air); starting a running clock does nothing. */
  start: () => void;
  /** Ends the cycle and puts every text back at its start, with no fade. */
  stop: () => void;
};

/** A box and its text, as the clock found them at a cycle start. */
type ScrollingTextPart = { box: HTMLElement; text: HTMLElement };

/** A text in the running cycle: its part and the animation that moves it. */
type TextInTheCycle = ScrollingTextPart & { animation: Animation };

/**
 * Makes `box` a scrolling text box for a graphic that writes its own DOM (the tower's
 * rows): marks it and wraps what it holds (a text, or a team name and its school that
 * scroll as one line) in the one text element, which it answers. Write a plain text with
 * writeScrollingTextIfChanged.
 */
export function makeScrollingTextBox(box: HTMLElement): HTMLElement {
  const existingText = findTextOfBox(box);
  if (existingText !== undefined) {
    return existingText;
  }
  box.classList.add(boxClassName);
  const text = document.createElement('span');
  text.className = textClassName;
  text.append(...box.childNodes);
  box.append(text);
  return text;
}

/** Writes `text` into a scrolling text box, only when it differs (textInPlace's rule). */
export function writeScrollingTextIfChanged(box: HTMLElement, text: string): void {
  const textElement = makeScrollingTextBox(box);
  writeTextIfChanged(textElement, text);
}

/**
 * The text element of a scrolling box, for a Lit template: the box around it carries the
 * class `scrolling-text-box` (written in the graphic's template, with its own classes).
 */
export function renderScrollingText(text: string): TemplateResult {
  return html`<span class="${textClassName}">${text}</span>`;
}

/** The text element directly inside a box, if the box has one. */
function findTextOfBox(box: Element): HTMLElement | undefined {
  for (const child of box.children) {
    if (child instanceof HTMLElement && child.classList.contains(textClassName)) {
      return child;
    }
  }
  return undefined;
}

/** Every box of the graphic with its text element, in document order. */
function findScrollingTextParts(root: ParentNode): ScrollingTextPart[] {
  const parts: ScrollingTextPart[] = [];
  for (const box of root.querySelectorAll<HTMLElement>(`.${boxClassName}`)) {
    const text = findTextOfBox(box);
    if (text !== undefined) {
      parts.push({ box, text });
    }
  }
  return parts;
}

/**
 * The widths the cycle needs: the text's, and the room the box gives it (its width inside
 * its padding, where the text starts and must end). offsetWidth and clientWidth ignore
 * transforms, so a text mid-scroll or a row mid-slide measures the same as at rest. A
 * hidden box measures 0 and so fits.
 */
function measurePart(part: ScrollingTextPart): ScrollingTextMeasure {
  const boxStyle = getComputedStyle(part.box);
  const paddingPx = readPixels(boxStyle.paddingLeft) + readPixels(boxStyle.paddingRight);
  const boxWidthPx = part.box.clientWidth - paddingPx;
  return { textWidthPx: part.text.offsetWidth, boxWidthPx };
}

/** A computed length in pixels; an empty or unreadable one (jsdom's) is 0. */
function readPixels(computedLength: string): number {
  const pixels = Number.parseFloat(computedLength);
  return Number.isNaN(pixels) ? 0 : pixels;
}

/** Names the phase on the box: the styles fade its edges while it scrolls (scrollingTextStyles). */
function writePhaseOnBox(box: HTMLElement, phase: ScrollingTextPhaseName): void {
  box.dataset.scrollPhase = phase;
}

/** Creates a stopped clock over a graphic's shadow root. */
export function createScrollingTextClock(options: ScrollingTextClockOptions): ScrollingTextClock {
  let isRunning = false;
  let cycleNumber = 0;
  let cycle: ScrollingTextCycle = { durationMs: 0, scrollDistancePxByName: new Map() };
  let timings: ScrollingTextTimings = readScrollingTextTimings(options.tokensSource);
  /** The texts moving in the running cycle, by the name the cycle knows them by. */
  let textsInTheCycle = new Map<string, TextInTheCycle>();
  /** The running cycle's timers: its phase changes and the start of the next cycle. */
  let pendingTimerIds: number[] = [];
  /** Each text element's name: a number given the first time the clock sees it. */
  const nameOfText = new WeakMap<HTMLElement, string>();
  let nextTextNumber = 1;
  let mutationObserver: MutationObserver | undefined;
  let resizeObserver: ResizeObserver | undefined;
  /** The elements the ResizeObserver already watches: watching one again reports it again. */
  let watchedForResize = new WeakSet<Element>();

  function nameText(text: HTMLElement): string {
    const knownName = nameOfText.get(text);
    if (knownName !== undefined) {
      return knownName;
    }
    const newName = `scrolling-text-${String(nextTextNumber)}`;
    nextTextNumber += 1;
    nameOfText.set(text, newName);
    return newName;
  }

  function watchPartForResize(part: ScrollingTextPart): void {
    if (resizeObserver === undefined) {
      return;
    }
    for (const element of [part.box, part.text]) {
      if (!watchedForResize.has(element)) {
        watchedForResize.add(element);
        resizeObserver.observe(element);
      }
    }
  }

  function bookTimer(callback: () => void, delayMs: number): void {
    pendingTimerIds.push(window.setTimeout(callback, delayMs));
  }

  function isCycleRunning(): boolean {
    return pendingTimerIds.length > 0;
  }

  /** Puts a text at its start, fully shown, with no phase (so no fade), and out of the cycle. */
  function restTextAtItsStart(name: string, textInTheCycle: TextInTheCycle): void {
    // Cancelling drops the animation's effect: the text is drawn as its own style, at rest.
    textInTheCycle.animation.cancel();
    delete textInTheCycle.box.dataset.scrollPhase;
    cycle = leaveTextOutOfTheCycle(cycle, name);
    textsInTheCycle.delete(name);
  }

  /** Writes a phase on a box when its timer comes, unless the text left the cycle. */
  function writePhaseWhileInTheCycle(name: string, phase: ScrollingTextPhaseName): void {
    const textInTheCycle = textsInTheCycle.get(name);
    if (textInTheCycle !== undefined) {
      writePhaseOnBox(textInTheCycle.box, phase);
    }
  }

  /** Starts one text's animation for the cycle and books the timers that name its phases. */
  function startTextInTheCycle(name: string, part: ScrollingTextPart): void {
    const moments = readPhaseMomentsOfText(cycle, name, timings);
    if (moments === undefined) {
      return;
    }
    const keyframes = buildScrollingTextKeyframes(cycle, name, timings);
    const animation = part.text.animate(keyframes, {
      duration: cycle.durationMs,
      easing: 'linear',
      id: `${scrollingTextCycleIdPrefix}${String(cycleNumber)}`,
    });
    // A new animation waits for the next frame to take its start time, while the phase
    // timers below count from now: starting it now keeps a box's phase in step with where
    // its text is (a frame late at a test's fast scroll is hundreds of pixels).
    animation.startTime = document.timeline.currentTime;
    textsInTheCycle.set(name, { ...part, animation });
    writePhaseOnBox(part.box, 'holdingAtStart');
    bookTimer(() => writePhaseWhileInTheCycle(name, 'scrolling'), moments.scrollStartsAtMs);
    bookTimer(() => writePhaseWhileInTheCycle(name, 'holdingAtEnd'), moments.scrollEndsAtMs);
    bookTimer(() => writePhaseWhileInTheCycle(name, 'fadingOutAtEnd'), moments.returnStartsAtMs);
    bookTimer(() => writePhaseWhileInTheCycle(name, 'fadingInAtStart'), moments.returnSwitchesAtMs);
  }

  /** Clears the cycle's timers and puts every text still in it back at its start. */
  function endTheRunningCycle(): void {
    for (const timerId of pendingTimerIds) {
      window.clearTimeout(timerId);
    }
    pendingTimerIds = [];
    for (const [name, textInTheCycle] of [...textsInTheCycle]) {
      restTextAtItsStart(name, textInTheCycle);
    }
  }

  /**
   * A cycle start: the last cycle's texts rest, every box is measured again with the
   * timings read anew, and the texts too long start their animations together, with one
   * timer that begins the next cycle when this one ends. With none too long the clock
   * waits for a change.
   */
  function beginTheNextCycle(): void {
    endTheRunningCycle();
    if (!isRunning) {
      return;
    }

    timings = readScrollingTextTimings(options.tokensSource);
    const measuresByName = new Map<string, ScrollingTextMeasure>();
    const partsByName = new Map<string, ScrollingTextPart>();
    for (const part of findScrollingTextParts(options.root)) {
      watchPartForResize(part);
      const name = nameText(part.text);
      measuresByName.set(name, measurePart(part));
      partsByName.set(name, part);
    }
    cycle = planScrollingTextCycle(measuresByName, timings);
    const hasTextToScroll = cycle.durationMs > 0;
    if (!hasTextToScroll) {
      return;
    }

    cycleNumber += 1;
    textsInTheCycle = new Map();
    for (const name of cycle.scrollDistancePxByName.keys()) {
      const part = partsByName.get(name);
      if (part !== undefined) {
        startTextInTheCycle(name, part);
      }
    }
    bookTimer(beginTheNextCycle, cycle.durationMs);
  }

  /** The text element a changed node belongs to, if it is inside one. */
  function findTextOfChangedNode(node: Node): HTMLElement | undefined {
    const element = node instanceof Element ? node : node.parentElement;
    const text = element?.closest<HTMLElement>(`.${textClassName}`);
    return text ?? undefined;
  }

  /** The cycle's text an element belongs to (its box or its text), if it is in the cycle. */
  function findTextInTheCycleOf(element: Element): [string, TextInTheCycle] | undefined {
    for (const [name, textInTheCycle] of textsInTheCycle) {
      if (textInTheCycle.box === element || textInTheCycle.text === element) {
        return [name, textInTheCycle];
      }
    }
    return undefined;
  }

  function onTextsChanged(records: MutationRecord[]): void {
    let mayHaveANewTextTooLong = false;
    for (const record of records) {
      const text = findTextOfChangedNode(record.target);
      const hasBoxesAdded = record.addedNodes.length > 0;
      if (text === undefined && !hasBoxesAdded) {
        continue;
      }
      mayHaveANewTextTooLong = true;
      const changedText = text === undefined ? undefined : findTextInTheCycleOf(text);
      if (changedText !== undefined) {
        const [name, textInTheCycle] = changedText;
        restTextAtItsStart(name, textInTheCycle);
      }
    }
    if (isRunning && !isCycleRunning() && mayHaveANewTextTooLong) {
      beginTheNextCycle();
    }
  }

  function onBoxesResized(entries: ResizeObserverEntry[]): void {
    for (const entry of entries) {
      const resizedText = findTextInTheCycleOf(entry.target);
      if (resizedText === undefined) {
        continue;
      }
      const [name, textInTheCycle] = resizedText;
      const distanceNowPx = measureScrollDistancePx(
        measurePart(textInTheCycle),
        timings.edgeFadePx,
      );
      const distanceInTheCyclePx = cycle.scrollDistancePxByName.get(name);
      // A browser reports every box once when first watched: same width, nothing to do.
      if (distanceNowPx !== distanceInTheCyclePx) {
        restTextAtItsStart(name, textInTheCycle);
      }
    }
    if (isRunning && !isCycleRunning()) {
      beginTheNextCycle();
    }
  }

  function start(): void {
    if (isRunning) {
      return;
    }
    isRunning = true;
    mutationObserver = new MutationObserver(onTextsChanged);
    mutationObserver.observe(options.root, { subtree: true, childList: true, characterData: true });
    // jsdom has no ResizeObserver: a resize is then seen at the next cycle start only.
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(onBoxesResized);
    }
    beginTheNextCycle();
  }

  function stop(): void {
    isRunning = false;
    mutationObserver?.disconnect();
    mutationObserver = undefined;
    resizeObserver?.disconnect();
    resizeObserver = undefined;
    watchedForResize = new WeakSet();
    endTheRunningCycle();
  }

  return { start, stop };
}

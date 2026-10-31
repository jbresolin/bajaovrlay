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
 * cycle start it finds every box, measures it, plans the cycle (scrollingTextCycle.ts) and
 * runs it as ONE GSAP timeline, so every text of the graphic starts and restarts together;
 * only `transform` and, in the return, `opacity` move, both compositor-friendly in OBS.
 * Texts that fit are not touched. A MutationObserver sees a text change and a
 * ResizeObserver a box resize: the text goes back to its start at once (its box keeps its
 * width) and joins at the next cycle start; with no cycle running, one starts.
 *
 * What could go wrong: the observers and the timeline would keep a stopped graphic busy
 * inside OBS; stop disconnects both and kills the timeline, and every graphic stops its
 * clock on stop, dispose and when it leaves the page.
 */
import { gsap } from 'gsap';
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
import { readScrollingTextTimings, type ScrollingTextTimings } from './scrollingTextTimings.js';
import { writeTextIfChanged } from './textInPlace.js';

/** The class that marks a clipped box; the clock finds the boxes by it. */
const boxClassName = 'scrolling-text-box';
/** The class of the one text element inside a box, the element that moves. */
const textClassName = 'scrolling-text';

/**
 * The `data` every cycle timeline carries, so a test can tell the clock's timeline from a
 * graphic's own motions (scrollingTextOnAir.testSupport.ts).
 */
export const scrollingTextCycleTimelineData = 'scrollingTextCycle';

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
  let cycleTimeline: gsap.core.Timeline | undefined;
  let cycle: ScrollingTextCycle = { durationMs: 0, scrollDistancePxByName: new Map() };
  let timings: ScrollingTextTimings = readScrollingTextTimings(options.tokensSource);
  /** The parts in the running cycle, by the name the cycle knows them by. */
  let partsInTheCycle = new Map<string, ScrollingTextPart>();
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
    const newName = `scrolling-text-${nextTextNumber}`;
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

  /** Puts a text at its start, fully shown, with no phase (so no fade), and out of the cycle. */
  function restPartAtItsStart(name: string, part: ScrollingTextPart): void {
    cycleTimeline?.killTweensOf(part.text);
    gsap.set(part.text, { x: 0, opacity: 1 });
    delete part.box.dataset.scrollPhase;
    cycle = leaveTextOutOfTheCycle(cycle, name);
    partsInTheCycle.delete(name);
  }

  function restEveryPartAtItsStart(): void {
    for (const [name, part] of [...partsInTheCycle]) {
      restPartAtItsStart(name, part);
    }
  }

  /** Writes a phase on a box when the timeline reaches it, unless the text left the cycle. */
  function writePhaseWhileInTheCycle(name: string, phase: ScrollingTextPhaseName): void {
    const part = partsInTheCycle.get(name);
    if (part !== undefined) {
      writePhaseOnBox(part.box, phase);
    }
  }

  /** Adds one text's moves to the cycle's timeline, at the moments the pure cycle gives. */
  function addPartToTimeline(timeline: gsap.core.Timeline, name: string, part: ScrollingTextPart): void {
    const moments = readPhaseMomentsOfText(cycle, name, timings);
    const scrollDistancePx = cycle.scrollDistancePxByName.get(name);
    if (moments === undefined || scrollDistancePx === undefined) {
      return;
    }
    const halfReturnSeconds = timings.returnMs / 2 / 1000;
    const scrollSeconds = (moments.scrollEndsAtMs - moments.scrollStartsAtMs) / 1000;
    timeline.call(() => writePhaseWhileInTheCycle(name, 'scrolling'), [], moments.scrollStartsAtMs / 1000);
    timeline.fromTo(
      part.text,
      { x: 0 },
      { x: -scrollDistancePx, duration: scrollSeconds, ease: 'none' },
      moments.scrollStartsAtMs / 1000,
    );
    timeline.call(() => writePhaseWhileInTheCycle(name, 'holdingAtEnd'), [], moments.scrollEndsAtMs / 1000);
    timeline.call(
      () => writePhaseWhileInTheCycle(name, 'fadingOutAtEnd'),
      [],
      moments.returnStartsAtMs / 1000,
    );
    timeline.to(
      part.text,
      { opacity: 0, duration: halfReturnSeconds, ease: 'none' },
      moments.returnStartsAtMs / 1000,
    );
    // Halfway through the return the end has faded out: the text jumps back unseen.
    timeline.set(part.text, { x: 0 }, moments.returnSwitchesAtMs / 1000);
    timeline.call(
      () => writePhaseWhileInTheCycle(name, 'fadingInAtStart'),
      [],
      moments.returnSwitchesAtMs / 1000,
    );
    timeline.to(
      part.text,
      { opacity: 1, duration: halfReturnSeconds, ease: 'none' },
      moments.returnSwitchesAtMs / 1000,
    );
  }

  /** Kills the cycle's timeline, if one runs, and puts its texts back at their start. */
  function endTheRunningCycle(): void {
    const runningTimeline = cycleTimeline;
    cycleTimeline = undefined;
    restEveryPartAtItsStart();
    runningTimeline?.kill();
  }

  /**
   * A cycle start: the last cycle's texts rest, every box is measured again with the
   * timings read anew, and the texts too long run in one new timeline that begins the
   * next cycle when it ends. With none too long the clock waits for a change.
   */
  function beginTheNextCycle(): void {
    endTheRunningCycle();
    if (!isRunning) {
      return;
    }

    timings = readScrollingTextTimings(options.tokensSource);
    const parts = findScrollingTextParts(options.root);
    const measuresByName = new Map<string, ScrollingTextMeasure>();
    const partsByName = new Map<string, ScrollingTextPart>();
    for (const part of parts) {
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

    partsInTheCycle = new Map();
    const timeline = gsap.timeline({
      data: scrollingTextCycleTimelineData,
      onComplete: beginTheNextCycle,
    });
    for (const name of cycle.scrollDistancePxByName.keys()) {
      const part = partsByName.get(name);
      if (part === undefined) {
        continue;
      }
      partsInTheCycle.set(name, part);
      writePhaseOnBox(part.box, 'holdingAtStart');
      addPartToTimeline(timeline, name, part);
    }
    cycleTimeline = timeline;
  }

  /** The text element a changed node belongs to, if it is inside one. */
  function findTextOfChangedNode(node: Node): HTMLElement | undefined {
    const element = node instanceof Element ? node : node.parentElement;
    const text = element?.closest<HTMLElement>(`.${textClassName}`);
    return text ?? undefined;
  }

  /** The cycle's part a node belongs to (its box or its text), if it is in the cycle. */
  function findCyclePartOfElement(element: Element): [string, ScrollingTextPart] | undefined {
    for (const [name, part] of partsInTheCycle) {
      if (part.box === element || part.text === element) {
        return [name, part];
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
      const changedPart = text === undefined ? undefined : findCyclePartOfElement(text);
      if (changedPart !== undefined) {
        const [name, part] = changedPart;
        restPartAtItsStart(name, part);
      }
    }
    const isWaitingForAChange = cycleTimeline === undefined;
    if (isRunning && isWaitingForAChange && mayHaveANewTextTooLong) {
      beginTheNextCycle();
    }
  }

  function onBoxesResized(entries: ResizeObserverEntry[]): void {
    for (const entry of entries) {
      const resizedPart = findCyclePartOfElement(entry.target);
      if (resizedPart === undefined) {
        continue;
      }
      const [name, part] = resizedPart;
      const distanceNowPx = measureScrollDistancePx(measurePart(part), timings.edgeFadePx);
      const distanceInTheCyclePx = cycle.scrollDistancePxByName.get(name);
      // A browser reports every box once when first watched: same width, nothing to do.
      if (distanceNowPx !== distanceInTheCyclePx) {
        restPartAtItsStart(name, part);
      }
    }
    const isWaitingForAChange = cycleTimeline === undefined;
    if (isRunning && isWaitingForAChange) {
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

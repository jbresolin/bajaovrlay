/**
 * Test support: a recording stand-in for `element.animate` in jsdom, which has no Web
 * Animations. No graphic's own module imports this file.
 *
 * The scrolling text clock (scrollingTextWhenTooLong.ts) hands each text too long for its
 * box to the browser as one Web Animation. Under jsdom nothing would run; this stand-in
 * records each call (the element, its keyframes, its options), the start time the clock
 * gave it, and whether it was paused or cancelled since, so a test can read what the clock
 * asked the browser to do. The document's timeline is a stand-in too, its time set by the
 * test (0 until then). It
 * never moves anything: where a text is at a moment is the pure cycle's to say
 * (scrollingTextKeyframes.test.ts proves the keyframes agree with it).
 */
import { onTestFinished } from 'vitest';

/** One call to `animate`, as the stand-in recorded it. */
export type RecordedAnimation = {
  element: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  id: string;
  /** The start time the clock set, or null when it left the browser to choose. */
  startTime: number | null;
  isPaused: boolean;
  isCancelled: boolean;
};

/** The stand-in's document timeline; a test moves its time with setTheDocumentTimeTo. */
const documentTimelineStandIn = { currentTime: 0 };

/** Every animation started since the stand-in was installed, in order. */
const recordedAnimations: RecordedAnimation[] = [];

/** Installs the stand-in on every element for the rest of the test; it is removed after. */
export function installRecordingWebAnimations(): void {
  recordedAnimations.length = 0;
  const realAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value(this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
      const recorded: RecordedAnimation = {
        element: this,
        keyframes,
        options,
        id: options.id ?? '',
        startTime: null,
        isPaused: false,
        isCancelled: false,
      };
      recordedAnimations.push(recorded);
      // Only what the clock uses of an Animation: its start time, pause and cancel. The
      // start time is written straight into the record.
      return Object.assign(recorded, {
        pause: () => {
          recorded.isPaused = true;
        },
        cancel: () => {
          recorded.isCancelled = true;
        },
      });
    },
  });
  // jsdom has no document timeline either; the clock reads its current time.
  const realTimeline = Object.getOwnPropertyDescriptor(document, 'timeline');
  documentTimelineStandIn.currentTime = 0;
  Object.defineProperty(document, 'timeline', {
    configurable: true,
    value: documentTimelineStandIn,
  });
  onTestFinished(() => {
    if (realTimeline === undefined) {
      Reflect.deleteProperty(document, 'timeline');
    } else {
      Object.defineProperty(document, 'timeline', realTimeline);
    }
    if (realAnimate === undefined) {
      Reflect.deleteProperty(Element.prototype, 'animate');
    } else {
      Object.defineProperty(Element.prototype, 'animate', realAnimate);
    }
    recordedAnimations.length = 0;
  });
}

/** The animations started and not cancelled, in the order they were started. */
export function listUncancelledAnimations(): RecordedAnimation[] {
  return recordedAnimations.filter((animation) => !animation.isCancelled);
}

/** The last animation started on `element`, cancelled or not. */
export function findLastAnimationOf(element: Element): RecordedAnimation | undefined {
  const animationsOfTheElement = recordedAnimations.filter(
    (animation) => animation.element === element,
  );
  return animationsOfTheElement[animationsOfTheElement.length - 1];
}

/** Moves the stand-in document timeline's time, in milliseconds since the page opened. */
export function setTheDocumentTimeTo(timeMs: number): void {
  documentTimelineStandIn.currentTime = timeMs;
}

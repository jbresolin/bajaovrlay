/**
 * The race clock's GSAP timelines (in, out, flag change) and their lengths. The play
 * and stop lengths are also promised to renderers in race-clock.ograf.json
 * ("actionDurations"); raceClockAnimations.test.ts and raceClockManifest.test.ts keep
 * the code and the manifest in agreement, so change both together.
 */
import { gsap } from 'gsap';

const panelSlideInMs = 400;
const flagBandOpenMs = 200;

/** How long playAction takes: the panel slides in, then the flag band opens. */
export const playInDurationMs = panelSlideInMs + flagBandOpenMs;
/** How long stopAction takes: the panel slides out and fades. */
export const stopOutDurationMs = 400;
/** How long a flag change takes during updateAction: the new colour wipes in. */
export const flagChangeDurationMs = 400;

/** The three elements the animations move. */
export type RaceClockAnimatedElements = {
  panel: HTMLElement;
  flagBand: HTMLElement;
  incomingFlagLayer: HTMLElement;
};

type Timeline = ReturnType<typeof gsap.timeline>;

const panelSlideDistancePx = -48;

// The incoming flag layer is revealed left to right by its clip; GSAP interpolates the
// percentages, so the wipe works for plain colours and the checkered pattern alike.
const flagLayerHiddenClip = 'inset(0% 100% 0% 0%)';
const flagLayerRevealedClip = 'inset(0% 0% 0% 0%)';

/** Builds the paused play-in timeline: panel slides in and fades up, then the band opens. */
export function buildPlayInTimeline(elements: RaceClockAnimatedElements): Timeline {
  const timeline = gsap.timeline({ paused: true });
  timeline.fromTo(
    elements.panel,
    { opacity: 0, x: panelSlideDistancePx },
    { opacity: 1, x: 0, duration: panelSlideInMs / 1000, ease: 'power3.out' },
  );
  timeline.fromTo(
    elements.flagBand,
    { scaleY: 0 },
    { scaleY: 1, duration: flagBandOpenMs / 1000, ease: 'power2.out' },
  );
  return timeline;
}

/** Builds the paused stop-out timeline: the panel slides back out and fades away. */
export function buildStopOutTimeline(elements: RaceClockAnimatedElements): Timeline {
  const timeline = gsap.timeline({ paused: true });
  timeline.to(elements.panel, {
    opacity: 0,
    x: panelSlideDistancePx,
    duration: stopOutDurationMs / 1000,
    ease: 'power2.in',
  });
  return timeline;
}

/** Builds the paused flag-change timeline: the incoming flag layer wipes in from the left. */
export function buildFlagChangeTimeline(elements: RaceClockAnimatedElements): Timeline {
  const timeline = gsap.timeline({ paused: true });
  timeline.fromTo(
    elements.incomingFlagLayer,
    { clipPath: flagLayerHiddenClip },
    {
      clipPath: flagLayerRevealedClip,
      duration: flagChangeDurationMs / 1000,
      ease: 'power2.inOut',
    },
  );
  return timeline;
}

/** Hides the incoming flag layer again, ready for the next flag change. */
export function hideIncomingFlagLayer(elements: RaceClockAnimatedElements): void {
  gsap.set(elements.incomingFlagLayer, { clipPath: flagLayerHiddenClip });
}

/** Puts the panel in its off-air look (invisible, slid out) without animating. */
export function placePanelOffAir(elements: RaceClockAnimatedElements): void {
  gsap.set(elements.panel, { opacity: 0, x: panelSlideDistancePx });
}

/**
 * Plays a paused timeline and resolves when it reaches its end. With skipAnimation it
 * jumps straight to the end, as OGraf asks. Ending it early with
 * `finishTimelineAtOnce` also resolves the promise, so nobody is left waiting.
 */
export function playTimelineToTheEnd(
  timeline: Timeline,
  options: { skipAnimation: boolean },
): Promise<void> {
  return new Promise((resolve) => {
    timeline.eventCallback('onComplete', () => resolve());
    if (options.skipAnimation) {
      timeline.progress(1);
    } else {
      timeline.play();
    }
  });
}

/**
 * Jumps a timeline to its end (firing its onComplete, so a pending
 * `playTimelineToTheEnd` resolves) and removes it from GSAP for good.
 */
export function finishTimelineAtOnce(timeline: Timeline): void {
  timeline.progress(1);
  timeline.kill();
}

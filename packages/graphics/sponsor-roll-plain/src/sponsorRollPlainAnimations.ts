/**
 * The plain sponsor roll's GSAP timelines: the card fades in over `--motion-in` and out over
 * `--motion-out`, and one sponsor gives way to the next by a cross-fade over
 * `--motion-swap`, inside the next sponsor's hold. Nothing moves or pulses. The durations
 * and eases come from the theme's motion tokens, read from the card's computed style when a
 * timeline is built; sponsorRollPlainManifest.test.ts keeps the manifest's
 * "actionDurations" equal to them. On a page without the theme every token reads as 0 and
 * the ease as linear (the theme package's rule), so every timeline ends.
 */
import { gsapEaseOfToken, readMotionTokens } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';

/** A paused GSAP timeline built by this module, played with the kit's `playTimelineToTheEnd`. */
export type PlainRollTimeline = ReturnType<typeof gsap.timeline>;

/** Builds the paused fade in: the card from invisible to fully visible. */
export function buildCardFadeInTimeline(card: HTMLElement): PlainRollTimeline {
  const motion = readMotionTokens(card);
  const timeline = gsap.timeline({ paused: true });
  timeline.fromTo(
    card,
    { opacity: 0 },
    { opacity: 1, duration: motion.inMs / 1000, ease: gsapEaseOfToken(motion.easeOut) },
  );
  return timeline;
}

/** Builds the paused fade out: the card to invisible. */
export function buildCardFadeOutTimeline(card: HTMLElement): PlainRollTimeline {
  const motion = readMotionTokens(card);
  const timeline = gsap.timeline({ paused: true });
  timeline.to(card, {
    opacity: 0,
    duration: motion.outMs / 1000,
    ease: gsapEaseOfToken(motion.easeIn),
  });
  return timeline;
}

/** Builds the paused turn: the sponsor on air fades out while the next fades in. */
export function buildSponsorTurnTimeline(
  card: HTMLElement,
  cellOnAir: HTMLElement,
  nextCell: HTMLElement,
): PlainRollTimeline {
  const motion = readMotionTokens(card);
  const durationSeconds = motion.swapMs / 1000;
  const timeline = gsap.timeline({ paused: true });
  timeline.to(cellOnAir, { opacity: 0, duration: durationSeconds, ease: 'none' }, 0);
  timeline.fromTo(
    nextCell,
    { opacity: 0 },
    { opacity: 1, duration: durationSeconds, ease: 'none' },
    0,
  );
  return timeline;
}

/** Puts the card in its off-air look (invisible) without animating. */
export function placeCardOffAir(card: HTMLElement): void {
  gsap.set(card, { opacity: 0 });
}

/** Shows one sponsor's cell and hides every other one, without animating. */
export function showOnlyTheCellAt(cells: HTMLElement[], cellIndex: number): void {
  cells.forEach((cell, index) => {
    gsap.set(cell, { opacity: index === cellIndex ? 1 : 0 });
  });
}

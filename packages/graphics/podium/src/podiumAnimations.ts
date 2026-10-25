/**
 * The podium's GSAP timelines, as motion.md describes them ("Podium"):
 * - in (Entrar): the head card rises `--motion-in-offset` and fades up over `--motion-in`;
 * - a step (Próximo): one card rises `--motion-podium-offset` and fades up over
 *   `--motion-in`; the other cards do not move. A play straight to a later step brings
 *   the head and those cards up together;
 * - out: the head and the revealed cards lift `--motion-in-offset` and fade together over
 *   `--motion-out`.
 * A card is revealed and hidden with GSAP's autoAlpha (opacity and visibility together), so
 * a hidden card keeps its room and never catches the eye. Every duration, offset and ease
 * is a theme token read when the timeline is built; on a page without the theme they read
 * as 0 and linear, so every timeline still ends. The manifest's "actionDurations" promise
 * `--motion-in` for play (a step) and `--motion-out` for stop; podiumManifest.test.ts keeps
 * the JSON and the token file in agreement.
 */
import { gsapEaseOfToken, readMotionTokens } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';

/** A paused GSAP timeline built by this module, played with the kit's `playTimelineToTheEnd`. */
export type PodiumTimeline = ReturnType<typeof gsap.timeline>;

/** What a rise brings up together: the head (on Entrar only) and the cards revealed. */
export type PodiumPiecesRisingIn = {
  head: HTMLElement | undefined;
  cards: HTMLElement[];
};

/**
 * Builds the paused rise: the head (when given) from its offset, each card from the podium
 * offset, all starting at 0 and lasting `--motion-in`.
 */
export function buildRiseInTimeline(
  tokensSource: Element,
  pieces: PodiumPiecesRisingIn,
): PodiumTimeline {
  const motion = readMotionTokens(tokensSource);
  const timeline = gsap.timeline({ paused: true });
  const toOnAir = {
    autoAlpha: 1,
    y: 0,
    duration: motion.inMs / 1000,
    ease: gsapEaseOfToken(motion.easeOut),
  };
  if (pieces.head !== undefined) {
    timeline.fromTo(pieces.head, { autoAlpha: 0, y: motion.inOffsetPx }, toOnAir, 0);
  }
  for (const card of pieces.cards) {
    timeline.fromTo(card, { autoAlpha: 0, y: motion.podiumOffsetPx }, toOnAir, 0);
  }
  return timeline;
}

/** Builds the paused lift-out: every piece given lifts its offset and fades away together. */
export function buildLiftOutTogetherTimeline(
  tokensSource: Element,
  pieces: HTMLElement[],
): PodiumTimeline {
  const motion = readMotionTokens(tokensSource);
  const timeline = gsap.timeline({ paused: true });
  if (pieces.length > 0) {
    timeline.to(
      pieces,
      {
        autoAlpha: 0,
        y: -motion.inOffsetPx,
        duration: motion.outMs / 1000,
        ease: gsapEaseOfToken(motion.easeIn),
      },
      0,
    );
  }
  return timeline;
}

/** Puts the head in its off-air look (invisible, below its place) without animating. */
export function placeHeadOffAir(tokensSource: Element, head: HTMLElement): void {
  const motion = readMotionTokens(tokensSource);
  gsap.set(head, { autoAlpha: 0, y: motion.inOffsetPx });
}

/** Hides cards at once (invisible, keeping their room, below their place, ready to rise). */
export function hideCardsAtOnce(tokensSource: Element, cards: HTMLElement[]): void {
  if (cards.length === 0) {
    return;
  }
  const motion = readMotionTokens(tokensSource);
  gsap.set(cards, { autoAlpha: 0, y: motion.podiumOffsetPx });
}

/** Shows cards at once in their place, as an update on air that fills a revealed slot asks. */
export function showCardsAtOnce(cards: HTMLElement[]): void {
  if (cards.length === 0) {
    return;
  }
  gsap.set(cards, { autoAlpha: 1, y: 0 });
}

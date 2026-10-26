/**
 * The bracket's GSAP timelines, as motion.md describes them ("Bracket"):
 * - in (Entrar, and every new view): the head (on Entrar) and the pieces shown at once (the
 *   tree's round names) rise `--motion-in-offset` and fade up over `--motion-in`; the
 *   cascade (a board's match cards, or the tree's car pills) follows, each
 *   `--motion-row-stagger` after the one before, `--motion-lead` after the head and names
 *   when they come too; the lines leading into a round fade in over `--motion-flag` once
 *   the cascade's last piece is in. A board of 32 is in at 100 + 32 × 30 + 400 = 1.5 s;
 * - out (Sair, and a board leaving for the next view): every piece given lifts
 *   `--motion-in-offset` and fades together over `--motion-out`;
 * - a result arriving on air: its cells fade in, the winner's chip fades green and the
 *   loser fades to its dimmed look, over `--motion-flag`. Nothing moves.
 * A piece is revealed and hidden with GSAP's autoAlpha (opacity and visibility together).
 * The loser's dimming is on the car inside the piece that moves, so a loser rises to its
 * dimmed opacity, not past it. Every duration, offset and ease is a theme token read when
 * the timeline is built; on a page without the theme they read as 0 and linear, so every
 * timeline still ends. bracketManifest.test.ts keeps the manifest's actionDurations and
 * the token file in agreement.
 */
import { gsapEaseOfToken, readMotionTokens } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';

/** A paused GSAP timeline built by this module, run by the kit's motion timeline runner. */
export type BracketTimeline = ReturnType<typeof gsap.timeline>;

/** What a rise brings in, in the order of motion.md. */
export type PiecesComingIn = {
  /** The head card, on Entrar only. */
  head: HTMLElement | undefined;
  /** Pieces that come at once with the head: the tree's round names. */
  atOnce: Element[];
  /** Pieces that cascade, in order: match cards, or car pills top to bottom. */
  cascade: Element[];
  /** Lines that fade in once the cascade's last piece is in. */
  linesAfter: Element[];
  /** Whether the cascade waits `--motion-lead` (after the head and names, or a new view). */
  isCascadeLed: boolean;
};

/** What a result arriving changed on screen: the cells, the winners' chips, the losers. */
export type ResultChangesOnScreen = {
  resultCells: Element[];
  winnerChipFills: Element[];
  losers: Element[];
};

/** Builds the paused rise of a step: head and names, the cascade, then the lines. */
export function buildCascadeInTimeline(
  tokensSource: Element,
  pieces: PiecesComingIn,
): BracketTimeline {
  const motion = readMotionTokens(tokensSource);
  const timeline = gsap.timeline({ paused: true });
  const toOnAir = {
    autoAlpha: 1,
    y: 0,
    duration: motion.inMs / 1000,
    ease: gsapEaseOfToken(motion.easeOut),
  };
  const fromBelow = { autoAlpha: 0, y: motion.inOffsetPx };

  if (pieces.head !== undefined) {
    timeline.fromTo(pieces.head, fromBelow, toOnAir, 0);
  }
  for (const piece of pieces.atOnce) {
    timeline.fromTo(piece, fromBelow, toOnAir, 0);
  }
  const cascadeStartMs = pieces.isCascadeLed ? motion.leadMs : 0;
  pieces.cascade.forEach((piece, pieceIndex) => {
    const startMs = cascadeStartMs + pieceIndex * motion.rowStaggerMs;
    timeline.fromTo(piece, fromBelow, toOnAir, startMs / 1000);
  });

  if (pieces.linesAfter.length > 0) {
    const lastPieceStartMs =
      cascadeStartMs + Math.max(0, pieces.cascade.length - 1) * motion.rowStaggerMs;
    const cascadeEndMs =
      pieces.cascade.length === 0 ? cascadeStartMs : lastPieceStartMs + motion.inMs;
    timeline.fromTo(
      pieces.linesAfter,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: motion.flagMs / 1000, ease: gsapEaseOfToken(motion.easeOut) },
      cascadeEndMs / 1000,
    );
  }
  return timeline;
}

/** Builds the paused lift-out: every piece given lifts its offset and fades away together. */
export function buildLiftOutTogetherTimeline(
  tokensSource: Element,
  pieces: Element[],
): BracketTimeline {
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

/**
 * Builds the paused crossfade of results arriving: each changed cell fades in, each new
 * winner's green fill fades up, each new loser fades from full to its dimmed look; the
 * styles hold the end look, so each tween clears its opacity when it ends.
 */
export function buildResultCrossfadeTimeline(
  tokensSource: Element,
  changes: ResultChangesOnScreen,
): BracketTimeline {
  const motion = readMotionTokens(tokensSource);
  const timeline = gsap.timeline({ paused: true });
  const crossfade = {
    duration: motion.flagMs / 1000,
    ease: gsapEaseOfToken(motion.easeOut),
    clearProps: 'opacity',
  };
  for (const cell of changes.resultCells) {
    timeline.from(cell, { opacity: 0, ...crossfade }, 0);
  }
  for (const fill of changes.winnerChipFills) {
    timeline.from(fill, { opacity: 0, ...crossfade }, 0);
  }
  for (const loser of changes.losers) {
    timeline.from(loser, { opacity: 1, ...crossfade }, 0);
  }
  return timeline;
}

/** Puts the head in its off-air look (invisible, below its place) without animating. */
export function placeHeadOffAir(tokensSource: Element, head: HTMLElement): void {
  const motion = readMotionTokens(tokensSource);
  gsap.set(head, { autoAlpha: 0, y: motion.inOffsetPx });
}

/**
 * Hides pieces at once, ready to come in: a card or a pill invisible below its place, a
 * line (an SVG path) invisible where it is, since a line only ever fades.
 */
export function hidePiecesAtOnce(tokensSource: Element, pieces: Element[]): void {
  const lines = pieces.filter((piece) => piece instanceof SVGElement);
  const piecesThatRise = pieces.filter((piece) => !(piece instanceof SVGElement));
  if (lines.length > 0) {
    gsap.set(lines, { autoAlpha: 0 });
  }
  if (piecesThatRise.length > 0) {
    const motion = readMotionTokens(tokensSource);
    gsap.set(piecesThatRise, { autoAlpha: 0, y: motion.inOffsetPx });
  }
}

/** Shows pieces at once in their place: a goto with no motion, or a piece an update added. */
export function showPiecesAtOnce(pieces: Element[]): void {
  if (pieces.length === 0) {
    return;
  }
  gsap.set(pieces, { autoAlpha: 1, y: 0 });
}

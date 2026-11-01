/**
 * The countdown's look in Ardósia: the card is the kit's clockCardStyles (the race clock's
 * card) without the band, the waiting screen the kit's narrowBoardStyles with the design's
 * `.countdown-board__body`, `__session`, `__time` and `__start` (PR #21,
 * docs/design/tools/slate-boards.css), all against the theme's tokens alone. No fallback
 * values, by design: without the theme the countdown is unstyled, and packages/theme's
 * noHardCodedValues guard keeps it so.
 */
import { narrowBoardStyles } from '@bajaovrlay/graphics-kit/boardStyles';
import { clockCardStyles } from '@bajaovrlay/graphics-kit/clockCardStyles';
import { css } from 'lit';

export const countdownStyles = [
  narrowBoardStyles,
  clockCardStyles,
  css`
    /* The card: head and body only, the race clock's card with no flag band. */
    .countdown-card {
      height: calc(var(--clock-height) - var(--flag-band-height));
      grid-template-rows: var(--clock-head-height) var(--clock-body-height);
    }

    /* The waiting screen's body: the session, the count big, the start time, centred. */
    .countdown-body {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-5) var(--space-5) calc(var(--space-5) + var(--space-2));
      text-align: center;
      /* Hidden until playAction animates it in. */
      opacity: 0;
    }

    /* A scrolling box (BAJAOVRLAY-55): as wide as the session's name up to the board's
       width, centred while it fits and starting at its left edge, to scroll, when it does
       not ("safe" alignment). */
    .countdown-session {
      display: flex;
      justify-content: safe center;
      max-width: 100%;
      font-size: var(--size-time);
      letter-spacing: var(--tracking-display);
      line-height: 1.2;
      white-space: nowrap;
    }

    .countdown-count {
      font-size: var(--size-countdown);
      letter-spacing: var(--tracking-time);
      line-height: 1;
      padding-top: var(--space-2);
    }

    .countdown-start {
      font-size: var(--size-title);
      letter-spacing: var(--tracking-display);
      color: var(--text-muted);
    }
  `,
];

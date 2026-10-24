/**
 * The message ticker's look in Ardósia: the design's `.message-ticker*` rules (PR #21,
 * docs/design/tools/slate-cards.css, on the strip's `.lower-strip` bar) written against the
 * theme's tokens alone; the clock block's look is the kit's (clockBlockStyles). No fallback
 * values, by design: without the theme the bar is unstyled, and packages/theme's
 * noHardCodedValues guard keeps it so.
 *
 * The bar is the strip's slot along the bottom (x 96..1824, y 954..1026): the clock block,
 * the label pill in the denser slate, the message pill and the page cell. It has no chip, no
 * yellow and no green, so it can never be read as a standings page.
 */
import { clockBlockStyles } from '@bajaovrlay/graphics-kit/clockBlockStyles';
import { css } from 'lit';

const messageTickerOwnStyles = css`
  :host {
    /* The graphic covers the whole 1920x1080 stage and places the bar along the bottom. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  .message-ticker {
    position: absolute;
    left: var(--stage-safe-side);
    right: var(--stage-safe-side);
    bottom: var(--stage-safe-bottom);
    height: var(--strip-height);
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--row-gap);
    font-family: var(--font-display);
    color: var(--text);
    text-transform: var(--case-rows);
    -webkit-font-smoothing: antialiased;
    font-variant-numeric: tabular-nums;
  }

  /* Without its clock block the bar is the label, the message and the page cell. */
  .message-ticker[data-clock-block='hidden'] {
    grid-template-columns: 1fr auto;
  }

  .pages {
    display: flex;
    gap: var(--row-gap);
    min-width: 0;
  }

  /* The label pill: the caption in the denser slate, so the bar reads as an announcement. */
  .label-pill {
    flex: none;
    display: flex;
    align-items: center;
    padding: 0 var(--space-4);
    border-radius: var(--radius);
    background: var(--panel-head);
    box-shadow: var(--shadow);
  }

  .label {
    font-family: var(--font-text);
    font-weight: var(--weight-caption);
    font-size: var(--size-caption);
    letter-spacing: var(--tracking-caption);
    color: var(--text-muted);
    white-space: nowrap;
  }

  /* The two message pills lie on top of each other; a page turn moves both at once. */
  .messages {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .message {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    padding: 0 var(--space-5);
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    font-size: var(--size-strip);
    letter-spacing: var(--tracking-row);
    line-height: 1.3;
    /* Never wrapped: the item editor refuses a message longer than the bar holds
       (messageLimits.ts), so the ellipsis is a last guard that should never show. */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .page-cell {
    display: flex;
    align-items: center;
    padding: 0 var(--space-4);
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    font-size: var(--size-strip);
    font-weight: var(--weight-number);
    color: var(--text-muted);
  }
`;

export const messageTickerStyles = [clockBlockStyles, messageTickerOwnStyles];

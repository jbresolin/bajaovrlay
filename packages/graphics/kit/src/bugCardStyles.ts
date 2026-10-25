/**
 * The bug's card in Ardósia, shared by the sponsor bug and the sponsor roll's corner card
 * (BAJAOVRLAY-46: "the bug's card"): the design's `.sponsor-bug*` rules (PR #19 and #21,
 * docs/design/tools/slate-base.css and slate-cards.css, with `.card`, `.caption` and
 * `.logo*`) written against the theme's tokens alone, moved here from the sponsor bug
 * unchanged. The card is the bug's slot (x 96..428 from y 54): the white mark at the left,
 * and beside it a column with the event word over the sponsor cell (a caption over the
 * logo, on the card or on the small light plate). No fallback values, by design: without
 * the theme the card is unstyled, and packages/theme's noHardCodedValues guard keeps it so.
 * Every rule but the card's own is scoped under `.sponsor-bug`, as clockCardStyles is under
 * `.clock-card`: these class names (.caption, .mark) recur in other parts of a graphic (the
 * sponsor roll's board head), and a bare rule would restyle them.
 */
import { css } from 'lit';

export const bugCardStyles = css`
  /* The card: top-left, opposite the column. */
  .sponsor-bug {
    position: absolute;
    top: var(--stage-safe-top);
    left: var(--bug-left);
    right: var(--bug-right);
    width: var(--bug-width);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    color: var(--text);
    font-family: var(--font-display);
    /* Bebas Neue has no lowercase: every word is set in caps (packages/theme/README.md). */
    text-transform: var(--case-title);
    -webkit-font-smoothing: antialiased;
    /* Hidden until playAction animates it in. */
    opacity: 0;
  }

  /* The Baja SAE Brasil mark, white on the slate. */
  .sponsor-bug .mark {
    flex: none;
    display: block;
    height: var(--bug-logo-height);
    width: auto;
    object-fit: contain;
  }

  /* The event word over the sponsor cell. */
  .sponsor-bug .text-column {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
  }

  .sponsor-bug .event-word {
    font-weight: var(--weight-display);
    font-size: var(--size-bug-label);
    letter-spacing: var(--tracking-display);
    line-height: 1;
    white-space: nowrap;
  }

  /* The sponsor cell: the caption over the logo strip. */
  .sponsor-bug .sponsor {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    /* The design's 2 px between the caption and the logo, half the smallest space. */
    gap: calc(var(--space-1) / 2);
    min-width: 0;
  }

  .sponsor-bug .caption {
    font-family: var(--font-text);
    font-weight: var(--weight-caption);
    font-size: var(--size-caption);
    letter-spacing: var(--tracking-caption);
    color: var(--text-muted);
    line-height: 1;
    white-space: nowrap;
  }

  /* The logo's strip: as tall as two caption lines, the logo whole inside it. */
  .sponsor-bug .sponsor-logo {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    box-sizing: border-box;
    height: var(--sponsor-logo-small-height);
    max-width: 100%;
  }

  /* A dark logo, or one on its own white box, sits on the small light plate. */
  .sponsor-bug .sponsor-logo.on-light-plate {
    padding: var(--logo-plate-padding);
    border-radius: var(--radius-chip);
    background: var(--panel-light);
  }

  .sponsor-bug .sponsor-logo-image {
    display: block;
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
  }
`;

/**
 * The sponsor bug's look in Ardósia: the design's `.sponsor-bug*` rules (PR #19 and #21,
 * docs/design/tools/slate-base.css and slate-cards.css, with `.card`, `.caption` and
 * `.logo*`) written against the theme's tokens alone. Every colour, size, face, corner and
 * duration is a `var(--token)` the renderer page sets on its :root
 * (packages/theme/ardosia/tokens.css); custom properties reach inside this shadow root.
 * No fallback values, by design: without the theme the bug is unstyled, and
 * packages/theme's noHardCodedValues guard keeps it so.
 *
 * The card's own rules are the kit's bugCardStyles, shared with the sponsor roll's corner
 * card (BAJAOVRLAY-46): the bug's slot (x 96..428 from y 54), the mark at the left, and
 * beside it a column with the event word over the sponsor cell.
 */
import { bugCardStyles } from '@bajaovrlay/graphics-kit/bugCardStyles';
import { css } from 'lit';

export const sponsorBugStyles = [
  css`
    :host {
      /* The graphic covers the whole 1920x1080 stage and places the card in the bug's slot. */
      position: absolute;
      inset: 0;
      display: block;
      pointer-events: none;
    }
  `,
  bugCardStyles,
];

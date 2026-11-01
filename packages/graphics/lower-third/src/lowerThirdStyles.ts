/**
 * The lower third's look in Ardósia: the design's `.lower-third*` rules
 * (docs/design/tools/slate-base.css, with `.card` of the same file and the direction's
 * own lines in docs/design/directions/ardosia/styles.css) written against the theme's
 * tokens alone. Every colour, size, face and corner is a `var(--token)` the renderer page
 * sets on its :root (packages/theme/ardosia/tokens.css); custom properties reach inside
 * this shadow root. No fallback values, by design: without the theme the lower third is
 * unstyled, and packages/theme's noHardCodedValues guard keeps it so.
 *
 * The two pills are anchored by their bottom edge, so a lower third without the role pill
 * keeps the name pill where the role pill would have ended: shorter, never an empty frame.
 * Each pill is as wide as what it holds, up to `--lower-third-max-width` (the safe width
 * left of the tower, BAJAOVRLAY-55): past it the name, the role or the team line scrolls
 * inside its box (the kit's scrollingTextStyles), the pill keeping its width.
 */
import { css } from 'lit';

export const lowerThirdStyles = css`
  :host {
    /* The graphic covers the whole 1920x1080 stage and places the pills bottom-left. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  /* A part the data has no use for is hidden; the flex display values below would
     otherwise win over the browser's own rule for [hidden]. */
  [hidden] {
    display: none !important;
  }

  /* Bottom-left, its bottom at y 940, above the room the strip and the ticker use. */
  .lower-third {
    position: absolute;
    left: var(--bug-left);
    bottom: var(--lower-third-bottom);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--row-gap);
    color: var(--text);
    font-family: var(--font-display);
    /* Bebas Neue has no lowercase: every word is set in caps (packages/theme/README.md),
       through the theme's token for names, so a theme with a mixed-case face can change it. */
    text-transform: var(--case-names);
    -webkit-font-smoothing: antialiased;
  }

  .pill {
    border-radius: var(--radius);
    background: var(--panel-base);
    box-shadow: var(--shadow);
    white-space: nowrap;
    max-width: var(--lower-third-max-width);
    box-sizing: border-box;
    /* Hidden until playAction animates it in. */
    opacity: 0;
  }

  /* The name: 64 px tall, the name at 44 px. */
  .name-pill {
    height: var(--name-height);
    display: flex;
    align-items: center;
    padding: 0 var(--space-5);
    font-size: var(--size-name);
    font-weight: var(--weight-display);
    letter-spacing: var(--tracking-row);
    line-height: 1;
  }

  /* The name's box: it shrinks inside the pill at the pill's maximum. Its line box holds
     the accents of a caps face (Bebas puts them above the cap height), which the box's
     clip would otherwise cut; centred in the pill, the letters stay where they were. */
  .name {
    min-width: 0;
    line-height: 1.3;
  }

  .role,
  .team-line {
    min-width: 0;
  }

  /* The role and the team line: 40 px tall, 22 px captions, the team line muted. */
  .role-pill {
    height: var(--role-height);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: 0 var(--space-4);
    font-family: var(--font-text);
    font-weight: var(--weight-caption);
    font-size: var(--size-role);
  }

  .role {
    letter-spacing: var(--tracking-caption);
  }

  .separator,
  .team-line {
    color: var(--text-muted);
    font-weight: var(--weight-row);
  }
`;

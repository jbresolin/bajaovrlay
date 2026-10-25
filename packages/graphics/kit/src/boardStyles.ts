/**
 * The narrow boards' frame and head card in Ardósia (BAJAOVRLAY-46): the design's `.board`,
 * `.board--narrow`, `.board__head`, `.board__logo`, `.board__title`, `.board__subtitle`,
 * `.board__aside`, `.card`, `.pill` and `.caption` rules (PR #21,
 * docs/design/tools/slate-boards.css on slate-base.css), written against the theme's tokens
 * alone, for the waiting screen, the sessions board, the intermission and the sponsor roll.
 * A board is `--board-width` (1280 px) wide and centred on the stage, so the bug and the
 * clock card stay visible beside it. Each board adds its own styles after these.
 * No fallback values, by design: without the theme a board is unstyled, and
 * packages/theme's noHardCodedValues guard keeps it so.
 */
import { css } from 'lit';

export const narrowBoardStyles = css`
  :host {
    /* The graphic covers the whole 1920x1080 stage and centres the board in it. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  .board {
    position: absolute;
    left: 50%;
    top: 50%;
    width: var(--board-width);
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    gap: var(--stack-gap);
    color: var(--text);
    font-family: var(--font-display);
    text-transform: var(--case-rows);
    /* Every digit the same width, so a count or a time never shifts as it changes. */
    font-variant-numeric: tabular-nums;
    -webkit-font-smoothing: antialiased;
  }

  .card,
  .pill {
    background: var(--panel-base);
    color: var(--text);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  .pill-head {
    background: var(--panel-head);
  }

  .caption {
    font-family: var(--font-text);
    font-weight: var(--weight-caption);
    font-size: var(--size-caption);
    letter-spacing: var(--tracking-caption);
    text-transform: uppercase;
    color: var(--text-muted);
    white-space: nowrap;
  }

  /* The head card: the logo, the title, the subtitle, the line at the right. */
  .board-head {
    height: var(--clock-head-height);
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: 0 var(--space-5);
    box-sizing: border-box;
    background: var(--panel-head);
    /* Hidden until playAction animates it in. */
    opacity: 0;
  }

  .board-logo {
    height: var(--clock-logo-height);
    width: auto;
    flex: none;
  }

  .board-title {
    margin: 0;
    font-family: var(--font-display);
    font-weight: var(--weight-display);
    font-size: var(--size-title);
    letter-spacing: var(--tracking-display);
    text-transform: var(--case-title);
    line-height: 1.3;
    white-space: nowrap;
  }

  .board-subtitle {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-left: var(--space-2);
  }

  .board-aside {
    flex: none;
    margin-left: auto;
    font-size: var(--size-row);
    color: var(--text-muted);
    white-space: nowrap;
  }
`;

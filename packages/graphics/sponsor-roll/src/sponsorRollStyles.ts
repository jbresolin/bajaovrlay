/**
 * The sponsor roll's look in Ardósia: the full screen on the kit's narrowBoardStyles with the
 * design's `.sponsor-roll__grid`, `.sponsor-tile` and `.logo*` rules; the corner on the kit's
 * bugCardStyles (the bug's card) with the design's `.sponsor-roll-corner__sponsor` (PR #21,
 * docs/design/tools/slate-boards.css and slate-cards.css), against the theme's tokens alone.
 * Each layout's two layers (tile grids, sponsor cells) are stacked in one grid cell, so a
 * page turns in place; the grid keeps two rows' height on a short page, so the board and
 * its head never move between pages. No fallback values, by design: without the theme the
 * roll is unstyled, and packages/theme's noHardCodedValues guard keeps it so.
 */
import { narrowBoardStyles } from '@bajaovrlay/graphics-kit/boardStyles';
import { bugCardStyles } from '@bajaovrlay/graphics-kit/bugCardStyles';
import { css } from 'lit';

export const sponsorRollStyles = [
  narrowBoardStyles,
  bugCardStyles,
  css`
    /* The two tile grids in one place: the page on air and the page turned to. */
    .page-stack {
      display: grid;
    }

    /* One page: up to six tiles, three a row, centred; always two rows tall. */
    .tile-grid {
      grid-area: 1 / 1;
      height: calc(2 * var(--sponsor-tile-height) + var(--stack-gap));
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-content: flex-start;
      gap: var(--stack-gap);
    }

    /* A tile's wrapper has no box of its own (sponsorRollView.ts says why it exists). */
    .tile-place {
      display: contents;
    }

    .sponsor-tile {
      width: calc((100% - 2 * var(--stack-gap)) / 3);
      height: var(--sponsor-tile-height);
      display: flex;
      align-items: center;
      justify-content: center;
      /* Hidden until playAction (or a page turn) brings it in. */
      opacity: 0;
    }

    /* The logo's box: one size for every tile, the logo whole inside it. */
    .tile-logo {
      width: var(--sponsor-tile-logo-width);
      height: var(--sponsor-tile-logo-height);
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }

    /* A dark logo, or one on its own white box, sits on the light plate. */
    .tile-logo.on-light-plate {
      padding: var(--logo-plate-padding);
      border-radius: var(--radius-chip);
      background: var(--panel-light);
    }

    .logo-image {
      display: block;
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      object-fit: contain;
    }

    /* The corner's two sponsor cells in one place, under the event word. */
    .sponsor-cells {
      display: grid;
      min-width: 0;
    }

    .sponsor-cell {
      grid-area: 1 / 1;
      opacity: 0;
    }
  `,
];

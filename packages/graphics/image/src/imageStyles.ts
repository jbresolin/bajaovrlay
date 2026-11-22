/**
 * The image graphic's look: no card, no plate, no shadow, only the operator's picture,
 * which comes with its own shape. Where the box sits and how big the picture is are the
 * item's (imageBoxPosition.ts, imageView.ts), so this file holds no size, margin or colour
 * of its own: the background and the margin are the item's too.
 */
import { css } from 'lit';

export const imageStyles = css`
  :host {
    /* The graphic covers the whole 1920x1080 stage and places the box on it. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
    /* A box pushed partly off the canvas is cut at its edge, never scrolls the page. */
    overflow: hidden;
  }

  .image-box {
    position: absolute;
    display: block;
    /* No line box under the picture, so the box is exactly as tall as the picture. */
    line-height: 0;
    /* Hidden until playAction brings it in. */
    opacity: 0;
  }

  .image-frame {
    /* Its padding and background are the item's (imageView.ts); none of its own. */
    display: block;
  }

  .image-picture {
    display: block;
    /* A width past the canvas must stay as asked, not shrink to the stage. */
    max-width: none;
  }

  /* A new file on its way (imageView.ts): hidden, and out of the layout, so the box keeps
     the size of the picture still on screen until the new one has arrived. */
  .image-picture[data-image-state='waiting'] {
    position: absolute;
    visibility: hidden;
  }
`;

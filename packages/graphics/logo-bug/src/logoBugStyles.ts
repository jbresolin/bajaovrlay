/**
 * The logo bug's look: no card, no plate, no shadow, only the operator's image, since a
 * channel logo comes with its own shape. The corner's margins are the theme's safe-area
 * tokens, put on the panel by the kit's screenCornerPosition; the height and the opacity
 * are the item's (logoBugModel.ts), so this file holds no size or colour of its own.
 */
import { css } from 'lit';

export const logoBugStyles = css`
  :host {
    /* The graphic covers the whole 1920x1080 stage and places the logo in its corner. */
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  .logo-bug {
    position: absolute;
    display: block;
    /* No line box under the image, so the panel is exactly as tall as the logo. */
    line-height: 0;
    /* Hidden until playAction fades it in. */
    opacity: 0;
  }

  .logo-image {
    display: block;
    width: auto;
  }

  /* A new file on its way (logoBugView.ts): hidden, and out of the layout, so the panel
     keeps the size of the logo still on screen until the new one has arrived. */
  .logo-image[data-image-state='waiting'] {
    position: absolute;
    visibility: hidden;
  }
`;

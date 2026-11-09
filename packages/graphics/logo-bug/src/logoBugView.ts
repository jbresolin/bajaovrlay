/**
 * The logo bug's DOM, drawn by Lit: one panel in the chosen corner (the kit's
 * screenCornerPosition), holding the logo at the chosen height and opacity. The panel is
 * what the fade moves; the operator's opacity sits on the image, so the two never fight
 * over one `opacity`. Lit keeps the panel across redraws, so the fade's inline opacity on
 * it survives an update on air.
 *
 * Up to two images: the logo on screen (`data-image-state="loaded"`) and a new file on its
 * way (`"waiting"`), hidden and out of the layout (logoBugStyles.ts) until it arrives. The
 * old logo stays up meanwhile, so a slow or broken new file never blanks the corner. Each
 * image is keyed by its fetch, so when the new file arrives the element that fetched it
 * is the one shown, never a second element loading the file again. A file that failed is
 * not in the template at all, so Chromium can never paint its broken-image icon. The
 * image is an `<img src>` and nothing else: an `<img>` runs no script even when the file
 * is an SVG (packages/graphics/README.md).
 */
import { describeScreenCornerPosition } from '@bajaovrlay/graphics-kit/screenCornerPosition';
import { html, nothing, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { LogoBugLook } from './logoBugModel.js';
import { ptBR } from './ptBR.js';

/** One fetch of a logo file: `fetchKey` tells two fetches of the same address apart. */
export type LogoImageFetch = { fetchKey: string; url: string };

/** An image to draw: on screen (its file arrived) or on its way (hidden until it does). */
export type LogoImageToDraw = LogoImageFetch & { state: 'loaded' | 'waiting' };

/** What an image on its way tells the graphic when it settles, naming its fetch. */
export type LogoImageEvents = {
  onImageLoaded: (fetchKey: string) => void;
  onImageFailed: (fetchKey: string) => void;
};

/** One image at the chosen height and opacity; the width follows the file's own shape. */
function renderLogoImage(
  look: LogoBugLook,
  image: LogoImageToDraw,
  imageEvents: LogoImageEvents,
): TemplateResult {
  const imageStyle = { height: `${String(look.heightPx)}px`, opacity: String(look.opacity) };
  return html`<img
    class="logo-image"
    data-testid="logo-bug-image"
    data-image-state=${image.state}
    src=${image.url}
    alt=${ptBR.logoAlternativeText}
    style=${styleMap(imageStyle)}
    @load=${() => imageEvents.onImageLoaded(image.fetchKey)}
    @error=${() => imageEvents.onImageFailed(image.fetchKey)}
  />`;
}

/**
 * The logo bug's markup: before load (no look yet) an empty panel, invisible until
 * played; after that the panel in its corner with the images to draw, none when the only
 * file failed.
 */
export function renderLogoBugTemplate(
  look: LogoBugLook | undefined,
  imagesToDraw: LogoImageToDraw[],
  imageEvents: LogoImageEvents,
): TemplateResult {
  if (look === undefined) {
    return html`<div class="logo-bug" data-testid="logo-bug-panel"></div>`;
  }
  const cornerOffsets = describeScreenCornerPosition(look.corner);
  const images =
    imagesToDraw.length === 0
      ? nothing
      : repeat(
          imagesToDraw,
          (image) => image.fetchKey,
          (image) => renderLogoImage(look, image, imageEvents),
        );
  return html`<div class="logo-bug" data-testid="logo-bug-panel" style=${styleMap(cornerOffsets)}>
    ${images}
  </div>`;
}

/** Finds the panel in the rendered template; a missing one is a bug in the template. */
export function findLogoBugPanel(renderRoot: ParentNode): HTMLElement {
  const panel = renderRoot.querySelector<HTMLElement>('[data-testid="logo-bug-panel"]');
  if (panel === null) {
    throw new Error('the logo bug panel is missing from the template; this is a bug');
  }
  return panel;
}

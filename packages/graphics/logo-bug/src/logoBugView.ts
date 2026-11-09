/**
 * The logo bug's DOM, drawn by Lit: one panel in the chosen corner (the kit's
 * screenCornerPosition), holding one image at the chosen height and opacity. The panel is
 * what the fade moves; the operator's opacity sits on the image, so the two never fight
 * over one `opacity`. Lit keeps the panel across redraws, so the fade's inline opacity on
 * it survives an update on air.
 *
 * The image is shown only once it has arrived (`data-image-state="loaded"`, see
 * logoBugStyles.ts), so a slow file never flashes in half drawn; a file that failed is
 * not in the template at all, so Chromium can never paint its broken-image icon. The
 * image is an `<img src>` and nothing else: an `<img>` runs no script even when the file
 * is an SVG (packages/graphics/README.md).
 */
import { describeScreenCornerPosition } from '@bajaovrlay/graphics-kit/screenCornerPosition';
import { html, nothing, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import type { LogoBugLook } from './logoBugModel.js';
import { ptBR } from './ptBR.js';

/** Where the current image is: on its way, arrived, or failed (missing or broken file). */
export type LogoImageState = 'waiting' | 'loaded' | 'failed';

/** What the image tells the graphic when it settles. */
export type LogoImageEvents = {
  onImageLoaded: () => void;
  onImageFailed: () => void;
};

/** The image at the chosen height and opacity; the width follows the file's own shape. */
function renderLogoImage(
  look: LogoBugLook,
  imageState: LogoImageState,
  imageEvents: LogoImageEvents,
): TemplateResult {
  const imageStyle = { height: `${String(look.heightPx)}px`, opacity: String(look.opacity) };
  return html`<img
    class="logo-image"
    data-testid="logo-bug-image"
    data-image-state=${imageState}
    src=${look.logoUrl}
    alt=${ptBR.logoAlternativeText}
    style=${styleMap(imageStyle)}
    @load=${imageEvents.onImageLoaded}
    @error=${imageEvents.onImageFailed}
  />`;
}

/**
 * The logo bug's markup: before load (no look yet) an empty panel, invisible until
 * played; after a failed image the panel in its corner with nothing in it.
 */
export function renderLogoBugTemplate(
  look: LogoBugLook | undefined,
  imageState: LogoImageState,
  imageEvents: LogoImageEvents,
): TemplateResult {
  if (look === undefined) {
    return html`<div class="logo-bug" data-testid="logo-bug-panel"></div>`;
  }
  const cornerOffsets = describeScreenCornerPosition(look.corner);
  const image = imageState === 'failed' ? nothing : renderLogoImage(look, imageState, imageEvents);
  return html`<div class="logo-bug" data-testid="logo-bug-panel" style=${styleMap(cornerOffsets)}>
    ${image}
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

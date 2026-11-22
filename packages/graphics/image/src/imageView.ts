/**
 * The image graphic's DOM, drawn by Lit: one box on the anchor's point of the canvas
 * (imageBoxPosition.ts), holding a frame (the item's background colour, margin and
 * opacity) around the picture at the item's width and height. The box is what the fade
 * moves; the operator's opacity sits on the frame, so the two never fight over one
 * `opacity`, and a background fades with its picture. Lit keeps the box across redraws,
 * so a new size or position on air changes its style in place and the fade's inline
 * opacity on it survives.
 *
 * The frame is dressed only while a picture is on screen: a file that failed leaves no
 * coloured square behind, so "nothing drawn" stays nothing.
 *
 * The size: the width is always set. With no height the picture's own proportions give
 * the height (`height: auto`), so the browser reads the file's real size and nothing here
 * has to. With a height too, the picture is fitted inside that box (`object-fit:
 * contain`), never stretched, and pinned to the anchor's side of it.
 *
 * Up to two pictures: the one on screen (`data-image-state="loaded"`) and a new file on
 * its way (`"waiting"`), hidden and out of the layout (imageStyles.ts) until it arrives,
 * as in the logo bug. A file that failed is not in the template at all, so Chromium can
 * never paint its broken-image icon. The picture is an `<img src>` and nothing else: an
 * `<img>` runs no script even when the file is an SVG (packages/graphics/README.md).
 */
import { html, nothing, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

import { describeImageBoxPosition } from './imageBoxPosition.js';
import type { ImageLook } from './imageModel.js';
import { ptBR } from './ptBR.js';

/** One fetch of an image file: `fetchKey` tells two fetches of the same address apart. */
export type ImageFileFetch = { fetchKey: string; url: string };

/** A picture to draw: on screen (its file arrived) or on its way (hidden until it does). */
export type ImageFileToDraw = ImageFileFetch & { state: 'loaded' | 'waiting' };

/** What a picture on its way tells the graphic when it settles, naming its fetch. */
export type ImageFileEvents = {
  onImageLoaded: (fetchKey: string) => void;
  onImageFailed: (fetchKey: string) => void;
};

/** The picture's own style: its width, its height or `auto`, and its fit. */
function describePictureStyle(look: ImageLook): Record<string, string> {
  const placement = describeImageBoxPosition(look.position, look.offsetXPx, look.offsetYPx);
  const hasHeight = look.heightPx !== undefined;
  return {
    width: `${String(look.widthPx)}px`,
    height: hasHeight ? `${String(look.heightPx)}px` : 'auto',
    // Only matters when both sides are set: the file is fitted inside, never stretched.
    'object-fit': 'contain',
    'object-position': placement.objectPosition,
  };
}

/**
 * The frame's style while a picture is on screen: the operator's opacity, the margin and
 * the background colour (none: transparent). Empty while nothing is on screen.
 */
function describeFrameStyle(look: ImageLook, isAPictureOnScreen: boolean): Record<string, string> {
  if (!isAPictureOnScreen) {
    return {};
  }
  return {
    opacity: String(look.opacity),
    padding: `${String(look.marginPx)}px`,
    'background-color': look.backgroundColor ?? 'transparent',
  };
}

/** One picture at the item's size and opacity. */
function renderPicture(
  look: ImageLook,
  image: ImageFileToDraw,
  imageEvents: ImageFileEvents,
): TemplateResult {
  return html`<img
    class="image-picture"
    data-testid="image-picture"
    data-image-state=${image.state}
    src=${image.url}
    alt=${ptBR.imageAlternativeText}
    style=${styleMap(describePictureStyle(look))}
    @load=${() => imageEvents.onImageLoaded(image.fetchKey)}
    @error=${() => imageEvents.onImageFailed(image.fetchKey)}
  />`;
}

/**
 * The image graphic's markup: before load (no look yet) an empty box, invisible until
 * played; after that the box on its anchor with the pictures to draw, none when the only
 * file failed.
 */
export function renderImageTemplate(
  look: ImageLook | undefined,
  imagesToDraw: ImageFileToDraw[],
  imageEvents: ImageFileEvents,
): TemplateResult {
  if (look === undefined) {
    return html`<div class="image-box" data-testid="image-box"></div>`;
  }
  const placement = describeImageBoxPosition(look.position, look.offsetXPx, look.offsetYPx);
  const boxStyle = {
    top: placement.top,
    right: placement.right,
    bottom: placement.bottom,
    left: placement.left,
    translate: placement.translate,
  };
  const pictures =
    imagesToDraw.length === 0
      ? nothing
      : repeat(
          imagesToDraw,
          (image) => image.fetchKey,
          (image) => renderPicture(look, image, imageEvents),
        );
  const isAPictureOnScreen = imagesToDraw.some((image) => image.state === 'loaded');
  const frameStyle = describeFrameStyle(look, isAPictureOnScreen);
  return html`<div class="image-box" data-testid="image-box" style=${styleMap(boxStyle)}>
    <div class="image-frame" data-testid="image-frame" style=${styleMap(frameStyle)}>
      ${pictures}
    </div>
  </div>`;
}

/** Finds the box in the rendered template; a missing one is a bug in the template. */
export function findImageBox(renderRoot: ParentNode): HTMLElement {
  const box = renderRoot.querySelector<HTMLElement>('[data-testid="image-box"]');
  if (box === null) {
    throw new Error('the image box is missing from the template; this is a bug');
  }
  return box;
}

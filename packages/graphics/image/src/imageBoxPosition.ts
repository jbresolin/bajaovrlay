/**
 * Where the image's box sits on the 1920x1080 canvas: the nine anchors the operator picks
 * from ("Posição") and, for each, the CSS that holds an absolutely placed box on that
 * point of the canvas, moved by the item's X and Y offsets.
 *
 * The anchors are the canvas's own edges and centre lines, not the title-safe area the
 * corner graphics keep: this graphic is placed by hand, so "top-left with no offset" is
 * pixel (0, 0) and the offsets read as plain canvas pixels. An offset may push the box
 * past the safe area or off the canvas; the operator decides.
 *
 * A centred anchor moves the box back by half its own size with the CSS `translate`
 * property, never `transform`, which GSAP owns on animated elements; the fade only
 * touches the opacity, but keeping them apart means neither can undo the other.
 * `objectPosition` pins the picture inside its box to the same side as the anchor, so an
 * image fitted into a box of another shape (width and height both set) still touches the
 * anchor's edges.
 */
import { z } from 'zod';

/** The nine anchors, in the order a form offers them: top row first, left before right. */
export const imageAnchors = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const;

/** One of the nine anchors; the data check for the "Posição" field. */
export const ImageAnchorSchema = z.enum(imageAnchors);

/** One of the nine anchors of the canvas. */
export type ImageAnchor = z.infer<typeof ImageAnchorSchema>;

/** The CSS of the box: four offsets (a length or `auto`), the centring and the picture's side. */
export type ImageBoxPlacement = {
  top: string;
  right: string;
  bottom: string;
  left: string;
  translate: string;
  objectPosition: string;
};

/** The CSS of one axis: the two offsets along it, the centring shift and the picture's side. */
type AxisPlacement = {
  startOffset: string;
  endOffset: string;
  centringShift: string;
  pictureSide: string;
};

const unusedOffset = 'auto';
const noShift = '0px';
const halfOfTheBoxBack = '-50%';

/** Writes a number of pixels as CSS, with -0 written as 0. */
function writePixels(pixels: number): string {
  const pixelsWithoutNegativeZero = pixels === 0 ? 0 : pixels;
  return `${String(pixelsWithoutNegativeZero)}px`;
}

/**
 * Places the box along one axis. `start` is the left or top edge, `end` the right or
 * bottom one. A positive offset always moves the box towards the end (right, or down),
 * whichever edge it is held by, so the operator never has to think about which edge.
 */
function placeAlongOneAxis(
  side: 'start' | 'centre' | 'end',
  offsetPx: number,
  pictureSides: { start: string; end: string },
): AxisPlacement {
  if (side === 'start') {
    return {
      startOffset: writePixels(offsetPx),
      endOffset: unusedOffset,
      centringShift: noShift,
      pictureSide: pictureSides.start,
    };
  }
  if (side === 'end') {
    // Held by the end edge, so moving towards the end means a smaller distance from it.
    return {
      startOffset: unusedOffset,
      endOffset: writePixels(-offsetPx),
      centringShift: noShift,
      pictureSide: pictureSides.end,
    };
  }
  return {
    startOffset: `calc(50% + ${writePixels(offsetPx)})`,
    endOffset: unusedOffset,
    centringShift: halfOfTheBoxBack,
    pictureSide: 'center',
  };
}

/** Which side of the canvas an anchor holds the box by, across (left to right). */
function readHorizontalSide(anchor: ImageAnchor): 'start' | 'centre' | 'end' {
  if (anchor.endsWith('-left')) {
    return 'start';
  }
  if (anchor.endsWith('-right')) {
    return 'end';
  }
  return 'centre';
}

/** Which side of the canvas an anchor holds the box by, down (top to bottom). */
function readVerticalSide(anchor: ImageAnchor): 'start' | 'centre' | 'end' {
  if (anchor.startsWith('top-')) {
    return 'start';
  }
  if (anchor.startsWith('bottom-')) {
    return 'end';
  }
  return 'centre';
}

/**
 * The CSS that puts the box on the anchor's point of the canvas, moved right by
 * `offsetXPx` and down by `offsetYPx` (negative numbers move it left and up).
 */
export function describeImageBoxPosition(
  anchor: ImageAnchor,
  offsetXPx: number,
  offsetYPx: number,
): ImageBoxPlacement {
  const across = placeAlongOneAxis(readHorizontalSide(anchor), offsetXPx, {
    start: 'left',
    end: 'right',
  });
  const down = placeAlongOneAxis(readVerticalSide(anchor), offsetYPx, {
    start: 'top',
    end: 'bottom',
  });
  return {
    top: down.startOffset,
    right: across.endOffset,
    bottom: down.endOffset,
    left: across.startOffset,
    translate: `${across.centringShift} ${down.centringShift}`,
    objectPosition: `${across.pictureSide} ${down.pictureSide}`,
  };
}

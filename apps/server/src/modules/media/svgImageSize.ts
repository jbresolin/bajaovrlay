// Telling an SVG document from any other text, and reading its size from its root
// element. An SVG is text, so nothing in its first bytes says what it is; the root
// element does.
import type { ImageSize } from './rasterImageSizes.js';

// What may come before the root element of an SVG file: a byte-order mark, white space,
// the XML declaration, comments and a DOCTYPE, in any number.
const partOfThePrologue = /^(?:\uFEFF|\s+|<\?xml[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>)/i;
// The root element's start tag, attributes included, when it is an <svg>.
const svgRootStartTag = /^<svg(?=[\s>/])[^>]*>/i;

/**
 * The start tag of the document's root element when the bytes are UTF-8 text whose root
 * element is <svg>, or undefined. An HTML page holding an SVG has <html> at its root and
 * is refused: a page can run script, an image must not.
 */
export function findSvgRootStartTag(bytes: Buffer): string | undefined {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
  let rest = text;
  // Peel the prologue off, one part at a time; each pass removes at least one character.
  let prologuePart = partOfThePrologue.exec(rest);
  while (prologuePart !== null) {
    rest = rest.slice(prologuePart[0].length);
    prologuePart = partOfThePrologue.exec(rest);
  }
  return svgRootStartTag.exec(rest)?.[0];
}

/**
 * An SVG's size from its root start tag: the width and height attributes when both are
 * plain numbers (or in px), else the width and height of its viewBox, rounded to whole
 * pixels. Undefined when it gives neither: a size in mm or % has no pixel size to answer.
 */
export function readSvgSize(rootStartTag: string): ImageSize | undefined {
  const widthPx = readLengthInPixels(readAttribute(rootStartTag, 'width'));
  const heightPx = readLengthInPixels(readAttribute(rootStartTag, 'height'));
  if (widthPx !== undefined && heightPx !== undefined) {
    return { widthPx, heightPx };
  }
  const viewBox = readAttribute(rootStartTag, 'viewBox');
  if (viewBox === undefined) {
    return undefined;
  }
  const viewBoxNumbers = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const viewBoxWidth = viewBoxNumbers[2];
  const viewBoxHeight = viewBoxNumbers[3];
  if (viewBoxNumbers.length !== 4 || viewBoxWidth === undefined || viewBoxHeight === undefined) {
    return undefined;
  }
  const widthFromViewBox = roundToWholePixels(viewBoxWidth);
  const heightFromViewBox = roundToWholePixels(viewBoxHeight);
  if (widthFromViewBox === undefined || heightFromViewBox === undefined) {
    return undefined;
  }
  return { widthPx: widthFromViewBox, heightPx: heightFromViewBox };
}

/** The value of one attribute of a start tag, in double or single quotes. */
function readAttribute(startTag: string, attributeName: string): string | undefined {
  const attributePattern = new RegExp(`\\s${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`);
  const match = attributePattern.exec(startTag);
  if (match === null) {
    return undefined;
  }
  return match[1] ?? match[2];
}

/** "320" or "320px" as 320; anything else (mm, em, %) as undefined. */
function readLengthInPixels(length: string | undefined): number | undefined {
  if (length === undefined) {
    return undefined;
  }
  const match = /^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/.exec(length);
  return match?.[1] === undefined ? undefined : roundToWholePixels(Number(match[1]));
}

/** A length rounded to whole pixels, at least 1; undefined for one that is not a size. */
function roundToWholePixels(length: number): number | undefined {
  if (!Number.isFinite(length) || length <= 0) {
    return undefined;
  }
  return Math.max(1, Math.round(length));
}

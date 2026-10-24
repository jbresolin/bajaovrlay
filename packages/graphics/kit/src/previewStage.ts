/**
 * The stage behind a graphic on its preview page: the footage stand-in (a gradient), or the
 * design's two screenshot backgrounds, grey and black, asked for with `?stage=grey|black`
 * so the screenshot tests and a reviewer see the graphic as the design pages show it. Each
 * preview.html paints the three (its colours live there, which the theme guard excludes).
 */

/** The three stages a preview page can paint behind its graphic. */
export type PreviewStage = 'footage' | 'grey' | 'black';

/** Reads `?stage=grey|black` from an address query string; anything else is the footage. */
export function choosePreviewStage(addressQuery: string): PreviewStage {
  const stageText = new URLSearchParams(addressQuery).get('stage');
  if (stageText === 'grey' || stageText === 'black') {
    return stageText;
  }
  return 'footage';
}

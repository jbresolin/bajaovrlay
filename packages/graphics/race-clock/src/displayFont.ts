/**
 * Loads the race clock's display font, Barlow Condensed (SIL Open Font License), from
 * files bundled into dist/ next to the graphic. Graphics never fetch from the internet
 * (OBS may be offline at the track), so no Google Fonts.
 *
 * Why FontFace and not @font-face in the styles: Chromium ignores @font-face rules
 * inside a shadow root, so the font is registered on the document instead.
 */
import barlowCondensedMediumAddress from '@fontsource/barlow-condensed/files/barlow-condensed-latin-500-normal.woff2?url';
import barlowCondensedBoldAddress from '@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2?url';

const displayFontFamily = 'Barlow Condensed';

let displayFontLoading: Promise<void> | undefined;

/**
 * Registers and loads the display font once per page, however many race clocks load.
 * Never fails: if the font cannot be loaded, the fallback in --baja-font-display is
 * used, because a plainer font on air is better than no clock on air.
 */
export function loadDisplayFontOnce(): Promise<void> {
  if (displayFontLoading === undefined) {
    displayFontLoading = registerAndLoadDisplayFontFaces();
  }
  return displayFontLoading;
}

async function registerAndLoadDisplayFontFaces(): Promise<void> {
  const fontFaces = [
    new FontFace(displayFontFamily, `url(${barlowCondensedMediumAddress}) format('woff2')`, {
      weight: '500',
    }),
    new FontFace(displayFontFamily, `url(${barlowCondensedBoldAddress}) format('woff2')`, {
      weight: '700',
    }),
  ];
  for (const fontFace of fontFaces) {
    document.fonts.add(fontFace);
  }
  try {
    await Promise.all(fontFaces.map((fontFace) => fontFace.load()));
  } catch {
    // Deliberately swallowed: see the doc comment above; the fallback font takes over.
  }
}

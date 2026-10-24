/**
 * The wait every graphic does before its first draw, so the first frame on air is set in
 * the theme's face and not in the fallback. The face is registered on the page by
 * fonts/fonts.css (the renderer links it, a preview imports it); a graphic registers no
 * font of its own and only waits here.
 *
 * Why `load` and then `ready`: on a cold start of OBS `document.fonts.ready` can resolve
 * before any text has asked for the face, so the file has not been fetched yet; asking
 * for the face by name starts the fetch and waits for it. The family comes from the
 * `--font-display` token, so a theme that changes the face is followed here too.
 */

/** The token the family is read from: the theme's display face, as a CSS font-family list. */
export const displayFontToken = '--font-display';

/**
 * Resolves once the theme's display face has loaded on the page, or at once where the
 * page has no `document.fonts` (jsdom in the unit tests) or the token is not on the page.
 * Never rejects: a face that fails to load leaves the fallback face on air, which is
 * better than no graphic on air. `element` is where the token is read (a graphic passes
 * itself; custom properties reach inside a shadow root).
 */
export async function waitForThemeFontsToBeReady(
  element: Element = document.documentElement,
): Promise<void> {
  // `document.fonts` is typed as always present, but jsdom has none.
  const pageFonts = document.fonts as FontFaceSet | undefined;
  if (pageFonts === undefined) {
    return;
  }
  const fontFamilyList = getComputedStyle(element).getPropertyValue(displayFontToken).trim();
  try {
    if (fontFamilyList !== '') {
      await pageFonts.load(`1em ${fontFamilyList}`);
    }
    await pageFonts.ready;
  } catch {
    // Deliberately swallowed: see the doc comment above.
  }
}

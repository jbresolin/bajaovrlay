/**
 * The race clock draws with the theme's face (Bebas Neue, registered on the page by
 * packages/theme/fonts/fonts.css, which the renderer links and the preview imports). The
 * graphic registers no font of its own; it only waits for the page's fonts before its
 * first draw, so the first frame on air is set in the face and not in the fallback.
 */

/**
 * Resolves once the page's fonts are ready; at once where the page has no `document.fonts`
 * (jsdom in the unit tests). Never rejects: a face that fails to load leaves the fallback
 * face on air, which is better than no clock on air.
 */
export async function waitForThemeFontsToBeReady(): Promise<void> {
  // `document.fonts` is typed as always present, but jsdom has none.
  const pageFonts = document.fonts as FontFaceSet | undefined;
  if (pageFonts === undefined) {
    return;
  }
  try {
    await pageFonts.ready;
  } catch {
    // Deliberately swallowed: see the doc comment above.
  }
}

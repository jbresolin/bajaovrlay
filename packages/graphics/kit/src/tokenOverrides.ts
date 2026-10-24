/**
 * Test support for the Playwright tests of the graphics (the tower's and the standings' page
 * holds): no graphic's own module imports this file.
 *
 * Puts theme tokens on the preview page's :root BEFORE the graphic loads. The graphic
 * reads its tokens when it builds each timeline and arms each page hold, so a test that
 * wants a shorter hold or faster motion must have its values on :root by then; a style
 * tag added after `page.goto` would race the page's own module, which loads and plays
 * the graphic as soon as it runs. An init script runs before any script of the page and
 * appends the style tag to the head as soon as the document has been parsed (readyState
 * "interactive", which comes before the page's module scripts run), after the theme's
 * own stylesheet, so the overrides win the cascade.
 */
import type { Page } from '@playwright/test';

/** Declares `tokens` on :root of every page the browser context opens from now on. */
export async function placeTokenOverridesBeforeTheGraphicLoads(
  page: Page,
  tokens: Record<string, string>,
): Promise<void> {
  const declarations = Object.entries(tokens)
    .map(([tokenName, value]) => `${tokenName}: ${value};`)
    .join(' ');
  await page.addInitScript((cssText: string) => {
    const appendOverrides = () => {
      const style = document.createElement('style');
      style.dataset.testid = 'token-overrides';
      style.textContent = `:root { ${cssText} }`;
      document.head.append(style);
    };
    if (document.readyState !== 'loading') {
      appendOverrides();
      return;
    }
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive') {
        appendOverrides();
      }
    });
  }, declarations);
}

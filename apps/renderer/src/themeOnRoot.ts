/**
 * Where index.html links the tokens from; the error line names it so an operator knows
 * which file to look for. index.html must link this same address.
 */
export const themeTokensAddress = '/theme/ardosia/tokens.css';

/**
 * The one token renderer.ts reads to know the theme's stylesheet reached :root. Every
 * graphic draws its panel with it, so a page without it draws unstyled graphics.
 */
export const themeTokenCheckedOnRoot = '--panel-base';

/**
 * Answers whether the theme's tokens are on the page's :root, by reading one of them
 * from the computed style of the document element. Read-only: it changes nothing.
 */
export function isThemeOnRoot(): boolean {
  const tokenValue = getComputedStyle(document.documentElement).getPropertyValue(
    themeTokenCheckedOnRoot,
  );
  return tokenValue.trim() !== '';
}

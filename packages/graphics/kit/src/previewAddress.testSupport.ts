/**
 * The preview page's address for the Playwright tests of every graphic. Test support only:
 * no graphic's own module imports this file.
 */

/**
 * Builds the preview.html address that shows a graphic with the given data, the same
 * `?data=<JSON>` form the control page uses.
 */
export function buildPreviewAddressWithData(data: Record<string, unknown>): string {
  return `preview.html?data=${encodeURIComponent(JSON.stringify(data))}`;
}

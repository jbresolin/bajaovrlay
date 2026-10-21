/**
 * Builds the preview.html address that shows the positions tower with the given data, the
 * same `?data=<JSON>` form the control page will use later.
 */
export function buildPreviewAddressWithData(data: Record<string, unknown>): string {
  return `preview.html?data=${encodeURIComponent(JSON.stringify(data))}`;
}

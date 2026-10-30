/**
 * Copies a renderer address for the operator to paste into OBS, and answers whether it
 * worked. The clipboard API first; browsers offer it only on https or localhost, and a
 * tablet at the event opens the page over plain http on the LAN, so without it the
 * address field's text is selected and copied the older way (`execCommand('copy')`,
 * deprecated but still offered everywhere). When that fails too, the text stays selected
 * and the page says to press Ctrl+C.
 */
export async function copyRendererAddress(
  address: string,
  addressField: HTMLInputElement | null,
): Promise<boolean> {
  const clipboard = navigator.clipboard as Clipboard | undefined;
  if (clipboard !== undefined) {
    try {
      await clipboard.writeText(address);
      return true;
    } catch {
      // A browser that refuses (no permission) falls through to the older way.
    }
  }
  const canCopyTheOlderWay = typeof document.execCommand === 'function';
  if (addressField === null || !canCopyTheOlderWay) {
    return false;
  }
  addressField.select();
  return document.execCommand('copy');
}

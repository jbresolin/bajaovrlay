import { useReadServerStateNow, useSendCommand } from '@/state/ControlPageStateProvider';

/**
 * Returns the function "Escolher carros" (BAJAOVRLAY-82) calls before "No ar" when the
 * item is also in "Prévia": the preview was resolved from the old pair, and a later
 * "Tomar" would put the OLD cars on air. It previews the item again with its new cars,
 * keeping the preview's origin (an automatic preview stays automatic, so the next one
 * still replaces it), and answers whether that went through (true when there was nothing
 * to refresh). It runs before the take, never after: the take's own automatic preview of
 * the next rundown item may land on the same layer, and must not be replaced by this one.
 */
export function useRefreshPreviewOfItem(): (itemId: string) => Promise<boolean> {
  const readServerStateNow = useReadServerStateNow();
  const sendCommand = useSendCommand();

  return async (itemId) => {
    const previewOfTheItem = readServerStateNow().instances.find(
      (instance) => instance.target === 'preview' && instance.itemId === itemId,
    );
    if (previewOfTheItem === undefined) {
      return true;
    }
    return sendCommand({
      type: 'previewItem',
      itemId,
      origin: previewOfTheItem.previewOrigin ?? 'manual',
    });
  };
}

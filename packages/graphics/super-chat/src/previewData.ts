/**
 * Chooses the data preview.html shows: the JSON in `?data=` when there is one, or the
 * short message sample. The two samples are also what the preview's buttons send. Whether
 * the data is valid is left to the graphic's own load(), so the preview shows exactly the
 * answer a renderer would get. Fictional viewers only, never a real person's name.
 */
import { ptBR } from './ptBR.js';
import type { SuperChatData } from './superChatModel.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** Builds the short message sample: Torcida Pequi Off-Road's R$ 20,00 from Goiânia. */
export function createShortMessageSample(): SuperChatData {
  return {
    amountText: 'R$ 20,00',
    authorName: 'Torcida Pequi Off-Road',
    messageText: 'Vai, Pequi! Abraço de Goiânia',
  };
}

/** Builds the sample of a viewer who paid R$ 5,00 and wrote nothing. */
export function createEmptyMessageSample(): SuperChatData {
  return { amountText: 'R$ 5,00', authorName: 'Ana do Paddock', messageText: '' };
}

/** Reads `?data=` from an address query string (location.search); never throws. */
export function choosePreviewData(addressQuery: string): PreviewDataChoice {
  const dataText = new URLSearchParams(addressQuery).get('data');
  if (dataText === null) {
    return { isReadable: true, data: createShortMessageSample() };
  }

  try {
    const data: unknown = JSON.parse(dataText);
    return { isReadable: true, data };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}

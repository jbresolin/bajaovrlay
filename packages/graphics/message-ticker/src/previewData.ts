/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or the
 * design's message-ticker page: "AVISO" and the enduro's three announcements, the race
 * clock an hour in under the green flag, the clock block unless the address says
 * `?clock=off`, and one message only with `?messages=1`. On a screenshot stage (`?stage=`)
 * the clock is held, so a baseline never depends on time. Whether the data is valid is
 * left to the graphic's own load(), so the preview shows exactly the answer a renderer gets.
 */
import type { MessageTickerData } from './messageTickerModel.js';
import { ptBR } from './ptBR.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** The enduro's three announcements, as the design's sample data writes them. */
export function createEnduroAnnouncements(): string[] {
  return [
    'Largada do enduro às 10h00',
    'Box aberto para abastecimento',
    'Premiação às 16h no palco principal',
  ];
}

/** Builds the design's ticker: "AVISO", the announcements, the clock an hour in. */
export function createEnduroTickerSample(options: {
  openedAtMs: number;
  messages: string[];
  isClockBlockShown: boolean;
  isClockRunning: boolean;
}): MessageTickerData {
  return {
    label: 'AVISO',
    messages: options.messages,
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_600_000,
    referenceWallClockMs: options.openedAtMs,
    running: options.isClockRunning,
    showClockBlock: options.isClockBlockShown,
  };
}

/** Reads the data from an address query string (location.search); never throws. */
export function choosePreviewData(addressQuery: string, openedAtMs: number): PreviewDataChoice {
  const searchParameters = new URLSearchParams(addressQuery);
  const dataText = searchParameters.get('data');
  if (dataText === null) {
    const announcements = createEnduroAnnouncements();
    const isOneMessage = searchParameters.get('messages') === '1';
    const data = createEnduroTickerSample({
      openedAtMs,
      messages: isOneMessage ? announcements.slice(0, 1) : announcements,
      isClockBlockShown: searchParameters.get('clock') !== 'off',
      isClockRunning: !searchParameters.has('stage'),
    });
    return { isReadable: true, data };
  }

  try {
    const data: unknown = JSON.parse(dataText);
    return { isReadable: true, data };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}

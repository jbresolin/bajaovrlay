/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or the real
 * enduro's 34 cars (realEnduroField.ts) with the race clock an hour in under the green
 * flag, counting from the moment the page opened, and the clock block unless the address
 * says `?clock=off`. Whether the data is valid is left to the graphic's own load(), so the
 * preview shows exactly the answer a renderer would get. The stage behind it is the kit's
 * `?stage=grey|black`.
 */
import type { LowerStripData } from './lowerStripModel.js';
import { ptBR } from './ptBR.js';
import { createRealEnduroField } from './realEnduroField.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** The time the sample's clock reads when the page opens: one hour of racing. */
const sampleClockTimeMs = 3_600_000;

/**
 * Builds the real enduro an hour in: 34 cars, the clock running from 1:00:00 at
 * `openedAtMs` under the green flag, the block shown or not. The clock is held at the
 * reading for `?stage=` screenshots, so a baseline never depends on how long a page took.
 */
export function createRealEnduroStripSample(options: {
  openedAtMs: number;
  isClockBlockShown: boolean;
  isClockRunning: boolean;
}): LowerStripData {
  return {
    entries: createRealEnduroField(),
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: sampleClockTimeMs,
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
    const isScreenshotStage = searchParameters.has('stage');
    const data = createRealEnduroStripSample({
      openedAtMs,
      isClockBlockShown: searchParameters.get('clock') !== 'off',
      isClockRunning: !isScreenshotStage,
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

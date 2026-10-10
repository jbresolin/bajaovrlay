/**
 * Chooses the data preview.html shows: the JSON in `?data=` when there is one, or a
 * running enduro sample read "now". Whether the data is valid is left to the graphic's
 * own load(), so the preview shows exactly the answer a renderer would get.
 */
import { ptBR } from './ptBR.js';
import type { RaceClockData } from './raceClockModel.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** Builds the sample: an enduro under green flag, running from 1:05:00 as of `nowWallClockMs`. */
function createRunningEnduroSample(nowWallClockMs: number): RaceClockData {
  return {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_900_000,
    referenceWallClockMs: nowWallClockMs,
    running: true,
    lapsCompletedByLeader: 12,
  };
}

/** Reads `?data=` from an address query string (location.search); never throws. */
export function choosePreviewData(addressQuery: string, nowWallClockMs: number): PreviewDataChoice {
  const dataText = new URLSearchParams(addressQuery).get('data');
  if (dataText === null) {
    return { isReadable: true, data: createRunningEnduroSample(nowWallClockMs) };
  }

  try {
    const data: unknown = JSON.parse(dataText);
    return { isReadable: true, data };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}

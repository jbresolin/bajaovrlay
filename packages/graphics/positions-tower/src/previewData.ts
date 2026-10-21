/**
 * The data preview.html shows and changes: the JSON in `?data=` when there is one, or
 * the enduro sample (60 cars, compact, pages cycling), and the pure changes the preview
 * buttons make to the list (two cars trading places). Whether the data is valid is left
 * to the graphic's own load(), so the preview shows exactly the answer a renderer would
 * get. The sample is the shared package's positions sample, imported through its own
 * export (decision 18 of the context pack): a package never reads another's inner files.
 */
import positionsSample from '@bajaovrlay/shared/samples/positions.json';

import {
  parseCompletePositionsTowerData,
  type PositionsTowerData,
  type TowerEntry,
} from './positionsTowerModel.js';
import { ptBR } from './ptBR.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/**
 * The sample the preview starts with: the 60 cars of the enduro at lap 34, compact,
 * pages cycling. Parsed through the tower's own model so the entries are typed; the
 * sample failing the model would be a bug in the sample or the model.
 */
export function createEnduroSampleTowerData(): PositionsTowerData {
  const check = parseCompletePositionsTowerData({
    entries: positionsSample.entries,
    layout: 'compact',
    paging: 'cycle',
  });
  if (!check.isValid) {
    throw new Error(`the positions sample must pass the tower's model: ${check.problem}`);
  }
  return check.data;
}

/** Reads `?data=` from an address query string (location.search); never throws. */
export function choosePreviewData(addressQuery: string): PreviewDataChoice {
  const dataText = new URLSearchParams(addressQuery).get('data');
  if (dataText === null) {
    return { isReadable: true, data: createEnduroSampleTowerData() };
  }

  try {
    const data: unknown = JSON.parse(dataText);
    return { isReadable: true, data };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}

/**
 * Trades the places of the cars at two positions (from 1) and answers a new list with
 * the positions rewritten, as the timing system would send it after an overtake. The
 * list given is never changed. Positions outside the list give the list unchanged.
 */
export function swapCarsAtPositions(
  entries: readonly TowerEntry[],
  positionA: number,
  positionB: number,
): TowerEntry[] {
  const swapped = [...entries];
  const carA = swapped[positionA - 1];
  const carB = swapped[positionB - 1];
  if (carA === undefined || carB === undefined) {
    return swapped;
  }
  swapped[positionA - 1] = { ...carB, position: positionA };
  swapped[positionB - 1] = { ...carA, position: positionB };
  return swapped;
}

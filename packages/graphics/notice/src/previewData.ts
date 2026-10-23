/**
 * Chooses the data preview.html shows: the JSON in `?data=` when there is one, or the
 * fastest lap sample. The two samples (one per variant) are also what the preview's
 * variant buttons send. Whether the data is valid is left to the graphic's own load(), so
 * the preview shows exactly the answer a renderer would get.
 */
import type { NoticeData } from './noticeModel.js';
import { ptBR } from './ptBR.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** Builds the fastest lap sample: car 31, Acauã Baja (Mauá), 4:38,2 on lap 34. */
export function createFastestLapSample(): NoticeData {
  return {
    variant: 'fastestLap',
    carNumber: 31,
    teamName: 'Acauã Baja',
    schoolName: 'Mauá',
    lapNumber: 34,
    lapTimeText: '4:38,2',
  };
}

/** Builds the penalty sample: car 47, Carnaúba Baja (UFERSA), +30 seconds for a jump start. */
export function createPenaltySample(): NoticeData {
  return {
    variant: 'penalty',
    carNumber: 47,
    teamName: 'Carnaúba Baja',
    schoolName: 'UFERSA',
    noticeKind: 'penalty',
    reason: 'Queima de largada',
    penaltyText: '+30 segundos',
  };
}

/** Reads `?data=` from an address query string (location.search); never throws. */
export function choosePreviewData(addressQuery: string): PreviewDataChoice {
  const dataText = new URLSearchParams(addressQuery).get('data');
  if (dataText === null) {
    return { isReadable: true, data: createFastestLapSample() };
  }

  try {
    const data: unknown = JSON.parse(dataText);
    return { isReadable: true, data };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}

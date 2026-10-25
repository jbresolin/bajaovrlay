/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or the 30ª
 * Competição's closest enduro battle (docs/design/sample-data.json, "battle": car 8,
 * Imperador, UTFPR-CWB, 4th, ahead of car 1, Equipe FEI Baja, FEI, 5th, 2,0 s apart) with
 * the trend the address sets by hand (`?trend=closing|opening|steady`, 0,7 s, the design's
 * sheet-battle page), and the stage behind it (`?stage=grey|black`). Whether the data is
 * valid is left to the graphic's own load(), so the preview shows exactly the answer a
 * renderer would get.
 *
 * "Atualizar" on the preview sends the next lap's reading (listPreviewLapReadings): the
 * design's five updates, the car behind one lap further each time, so the trend the
 * graphic works out goes steady, opening, closing, opening, closing, and then a reading
 * whose word stays and whose number changes.
 */
import type { BattleCardData } from './battleCardModel.js';
import type { TrendWord } from './battleTrend.js';
import { ptBR } from './ptBR.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** One lap's reading, as an update of the preview sends it. */
export type PreviewLapReading = { aheadLaps: number; behindLaps: number; gapMs: number };

/** The change the design's sheet-battle page shows for a trend set by hand: 0,7 s. */
const sheetBattleChangeMs = 700;

/** Builds the battle at lap 1: Imperador 4th, Equipe FEI Baja 5th, +2,0. */
export function createImperadorAndFeiSample(): BattleCardData {
  return {
    aheadPosition: 4,
    aheadCarNumber: 8,
    aheadTeamName: 'Imperador',
    aheadSchoolName: 'UTFPR-CWB',
    aheadLaps: 1,
    behindPosition: 5,
    behindCarNumber: 1,
    behindTeamName: 'Equipe FEI Baja',
    behindSchoolName: 'FEI',
    behindLaps: 1,
    gapMs: 2000,
  };
}

/**
 * The laps after the first, one a reading: +3,0 (opening 1,0), +2,0 (closing 1,0), +13,0
 * (opening 11,0), +11,0 (closing 2,0), as the design's motion demo, then +8,3 (still
 * closing, now 2,7: only the number changes).
 */
export function listPreviewLapReadings(): PreviewLapReading[] {
  return [
    { aheadLaps: 2, behindLaps: 2, gapMs: 3000 },
    { aheadLaps: 3, behindLaps: 3, gapMs: 2000 },
    { aheadLaps: 4, behindLaps: 4, gapMs: 13_000 },
    { aheadLaps: 5, behindLaps: 5, gapMs: 11_000 },
    { aheadLaps: 6, behindLaps: 6, gapMs: 8300 },
  ];
}

/** Reads the trend set by hand from the address, or undefined for the one worked out. */
function readTrendFromAddress(
  searchParameters: URLSearchParams,
): Exclude<TrendWord, 'none'> | undefined {
  const trend = searchParameters.get('trend');
  if (trend === 'closing' || trend === 'opening' || trend === 'steady') {
    return trend;
  }
  return undefined;
}

/** Reads the data from an address query string (location.search); never throws. */
export function choosePreviewData(addressQuery: string): PreviewDataChoice {
  const searchParameters = new URLSearchParams(addressQuery);
  const dataText = searchParameters.get('data');
  if (dataText === null) {
    const sample = createImperadorAndFeiSample();
    const manualTrend = readTrendFromAddress(searchParameters);
    if (manualTrend !== undefined) {
      sample.manualTrend = manualTrend;
      sample.manualTrendChangeMs = sheetBattleChangeMs;
    }
    return { isReadable: true, data: sample };
  }

  try {
    const data: unknown = JSON.parse(dataText);
    return { isReadable: true, data };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}

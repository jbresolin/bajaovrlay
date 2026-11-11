/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or one of the
 * sample matches of a Super Prime: `?match=before|during|after|times|third-place|empty`
 * (the second semifinal before it starts, at 1 × 1, after Pequi took it, a timed
 * quarter-final, the third place, and an empty "agora"), `during` when none is named,
 * with `?corner=top-left|top-right|bottom-left|bottom-right`. Whether the data is valid is
 * left to the graphic's own load(), so the preview shows exactly the answer a renderer
 * would get. The teams are real Super Prime short names.
 */
import { ptBR } from './ptBR.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** The second semifinal before it starts: Corisco (47) against Pequi (12), a best of 3. */
function buildSemifinalBeforeItStarts(): Record<string, unknown> {
  return {
    roundName: 'Semifinal',
    bestOf: 3,
    carANumber: 47,
    carAShortName: 'Corisco',
    carBNumber: 12,
    carBShortName: 'Pequi',
  };
}

/** Each sample match by the name the address gives it. */
function buildSampleMatch(matchName: string): Record<string, unknown> {
  switch (matchName) {
    case 'before':
      return buildSemifinalBeforeItStarts();
    case 'after':
      return { ...buildSemifinalBeforeItStarts(), carAWins: 1, carBWins: 2, winnerCarNumber: 12 };
    case 'times':
      return {
        roundName: 'Quartas de final',
        carANumber: 47,
        carAShortName: 'Corisco',
        carATimeMs: 41_870,
        carBNumber: 34,
        carBShortName: 'Buffalo',
        carBTimeMs: 43_215,
        winnerCarNumber: 47,
      };
    case 'third-place':
      return {
        roundName: 'Disputa de 3º lugar',
        bestOf: 3,
        carANumber: 13,
        carAShortName: 'Cactus',
        carAWins: 1,
        carBNumber: 29,
        carBShortName: 'UFSC',
        carBWins: 0,
      };
    case 'empty':
      return {};
    default:
      return { ...buildSemifinalBeforeItStarts(), carAWins: 1, carBWins: 1 };
  }
}

/** Reads the data from an address query string (location.search); never throws. */
export function choosePreviewData(addressQuery: string): PreviewDataChoice {
  const searchParameters = new URLSearchParams(addressQuery);
  const dataText = searchParameters.get('data');
  if (dataText !== null) {
    try {
      const data: unknown = JSON.parse(dataText);
      return { isReadable: true, data };
    } catch {
      return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
    }
  }
  const sample = buildSampleMatch(searchParameters.get('match') ?? 'during');
  const corner = searchParameters.get('corner');
  if (corner !== null) {
    sample.corner = corner;
  }
  return { isReadable: true, data: sample };
}

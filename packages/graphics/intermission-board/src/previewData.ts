/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or the design's
 * sample (the `intermission-board` page: the break before the Enduro de Resistência, 23:45
 * from "now", the 30ª Competição's overall top five, and its 17 sponsors on the line) with
 * the parts the address switches off (`?topFive=off`, `?sponsors=off`, the four combinations
 * of the design's motion demos); `?nextStartsAtMs=` fixes the start instead (the
 * screenshots, whose page clock is set). Whether the data is valid is left to the graphic's own
 * load(). The stage behind it is the kit's `?stage=grey|black`.
 *
 * The 17 and their logos are the kit's sample (the30thCompetitionSponsorsSample), shared
 * with the sponsor roll's preview.
 */
import { createThe30thCompetitionSponsorsSample } from '@bajaovrlay/graphics-kit/the30thCompetitionSponsorsSample';

import type { IntermissionBoardData, TopFiveEntry } from './intermissionBoardModel.js';
import { ptBR } from './ptBR.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** Which optional parts the sample shows. */
export type SampleParts = { hasTopFive: boolean; hasSponsors: boolean };

/** How long before the start the sample opens: the design's 23:45. */
export const sampleTimeBeforeTheStartMs = (23 * 60 + 45) * 1000;

/** The 30ª Competição's overall top five, as the design's page shows it. */
export function createThe30thCompetitionTopFive(): TopFiveEntry[] {
  return [
    { rank: 1, carNumber: 2, teamName: 'Baja UFMG', schoolName: 'UFMG', points: 921.8 },
    { rank: 2, carNumber: 1, teamName: 'Equipe FEI Baja', schoolName: 'FEI', points: 903.48 },
    {
      rank: 3,
      carNumber: 10,
      teamName: 'Equipe Komiketo Baja',
      schoolName: 'UFSJ',
      points: 891.59,
    },
    { rank: 4, carNumber: 47, teamName: 'Pato Baja', schoolName: 'UTFPR-PB', points: 889.75 },
    { rank: 5, carNumber: 5, teamName: 'Poli Baja', schoolName: 'POLI', points: 811.78 },
  ];
}

/** Builds the design's break with the chosen parts, its start 23:45 after `nowMs`. */
export function createBreakBeforeTheEnduroSample(
  parts: SampleParts,
  nowMs: number,
): IntermissionBoardData {
  const sample: IntermissionBoardData = {
    eventLine: '30ª Competição Baja SAE Brasil',
    dateLine: 'domingo, 30 de março de 2025',
    nextSessionName: 'Enduro de Resistência',
    nextStartsAtMs: nowMs + sampleTimeBeforeTheStartMs,
  };
  if (parts.hasTopFive) {
    sample.topFive = createThe30thCompetitionTopFive();
  }
  if (parts.hasSponsors) {
    sample.sponsors = createThe30thCompetitionSponsorsSample();
  }
  return sample;
}

/** Reads the data from an address query string (location.search) at `nowMs`; never throws. */
export function choosePreviewData(addressQuery: string, nowMs: number): PreviewDataChoice {
  const searchParameters = new URLSearchParams(addressQuery);
  const dataText = searchParameters.get('data');
  if (dataText === null) {
    const parts = {
      hasTopFive: searchParameters.get('topFive') !== 'off',
      hasSponsors: searchParameters.get('sponsors') !== 'off',
    };
    const sample = createBreakBeforeTheEnduroSample(parts, nowMs);
    const fixedStartText = searchParameters.get('nextStartsAtMs');
    if (fixedStartText !== null) {
      sample.nextStartsAtMs = Number(fixedStartText);
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

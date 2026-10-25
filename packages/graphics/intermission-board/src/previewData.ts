/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or the design's
 * sample (the `intermission-board` page: the break before the Enduro de Resistência, 23:45
 * from "now", the 30ª Competição's overall top five, and its 17 sponsors on the line) with
 * the parts the address switches off (`?topFive=off`, `?sponsors=off`, the four combinations
 * of the design's motion demos); `?nextStartsAtMs=` fixes the start instead (the
 * screenshots, whose page clock is set). Whether the data is valid is left to the graphic's own
 * load(). The stage behind it is the kit's `?stage=grey|black`.
 *
 * The logos are files of this package (copies of docs/design/sample_data/logos/sponsors),
 * imported through Vite so they land in dist/ with the preview.
 */
import boschLogoUrl from '../preview-images/bosch.webp';
import certiLogoUrl from '../preview-images/certi.webp';
import cnhLogoUrl from '../preview-images/cnh.webp';
import criciumaLogoUrl from '../preview-images/criciuma.webp';
import himixLogoUrl from '../preview-images/himix.webp';
import horseLogoUrl from '../preview-images/horse.webp';
import marcopoloLogoUrl from '../preview-images/marcopolo.webp';
import osakiLogoUrl from '../preview-images/osaki.webp';
import renaultLogoUrl from '../preview-images/renault.webp';
import rodonunesLogoUrl from '../preview-images/rodonunes.webp';
import saeLogoUrl from '../preview-images/sae.webp';
import sae4mobilityLogoUrl from '../preview-images/sae4mobility.webp';
import satcLogoUrl from '../preview-images/satc.webp';
import schulzLogoUrl from '../preview-images/schulz.webp';
import segulaLogoUrl from '../preview-images/segula.webp';
import trpLogoUrl from '../preview-images/trp.webp';
import vetoreLogoUrl from '../preview-images/vetore.webp';
import type {
  IntermissionBoardData,
  SponsorLineSponsor,
  TopFiveEntry,
} from './intermissionBoardModel.js';
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

/** One sponsor of the sample, on the light plate unless the design says its logo is light. */
function buildSponsor(
  name: string,
  level: SponsorLineSponsor['level'],
  logoUrl: string,
  logoOnLightPlate = true,
): SponsorLineSponsor {
  return { name, level, logoUrl, logoOnLightPlate, rollWeight: 5 };
}

/** The 30ª Competição's 17 sponsors in the server's order. */
export function createThe30thCompetitionSponsors(): SponsorLineSponsor[] {
  return [
    buildSponsor('Bosch', 'diamante', boschLogoUrl),
    buildSponsor('Renault', 'diamante', renaultLogoUrl),
    buildSponsor('Certi', 'ouro', certiLogoUrl),
    buildSponsor('CNH', 'ouro', cnhLogoUrl),
    buildSponsor('Himix', 'ouro', himixLogoUrl),
    buildSponsor('Horse', 'ouro', horseLogoUrl),
    buildSponsor('Marcopolo', 'ouro', marcopoloLogoUrl),
    buildSponsor('Rodonunes', 'ouro', rodonunesLogoUrl),
    buildSponsor('Segula', 'ouro', segulaLogoUrl),
    buildSponsor('TRP', 'ouro', trpLogoUrl),
    buildSponsor('Vetore', 'ouro', vetoreLogoUrl, false),
    buildSponsor('Criciúma', 'apoio', criciumaLogoUrl),
    buildSponsor('Osaki', 'apoio', osakiLogoUrl),
    buildSponsor('SAE4Mobility', 'apoio', sae4mobilityLogoUrl),
    buildSponsor('SATC', 'apoio', satcLogoUrl),
    buildSponsor('Schulz', 'apoio', schulzLogoUrl),
    buildSponsor('SAE Brasil', 'realizacao', saeLogoUrl),
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
    sample.sponsors = createThe30thCompetitionSponsors();
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

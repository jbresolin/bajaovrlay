/**
 * The data preview.html shows: the JSON in `?data=` when there is one, or the enduro's
 * podium of the 30ª Competição as the design pages draw it (docs/design/sample-data.json,
 * "podium"): Sinuelo (car 51) first, Equipe Komiketo Baja (car 10) second, Pato Baja (car 47)
 * third, as a positions list cut to three with each team's logo joined, as the item's
 * binding (topN 3, then withTeamLogos) hands it over. `?logos=off` sends the same podium
 * without logos, and `?tie=on` the overall standings with a tie for first. Whether the data
 * is valid is left to the graphic's own load(), so the preview shows exactly the answer a
 * renderer would get. The browser tests open the preview with these same samples.
 *
 * The three logos are the teams' real ones (docs/design/sample_data/logos/teams/51, 10 and
 * 47.webp), files of this package imported through Vite so they land in dist/ with the
 * preview. Sinuelo's is white on black and stands on the panel; Komiketo's and Pato Baja's
 * are dark marks and sit on the light plate, as prepareLogos.mjs decided for the design.
 */
import komiketoBajaLogoUrl from '../preview-images/komiketo-baja-logo.webp';
import patoBajaLogoUrl from '../preview-images/pato-baja-logo.webp';
import sinueloLogoUrl from '../preview-images/sinuelo-logo.webp';
import type { PodiumData, PodiumEntry } from './podiumModel.js';
import { ptBR } from './ptBR.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/**
 * The enduro's first three as the positions shape lists them (laps and status ride along,
 * as they do from a real source), with or without the logos withTeamLogos would join.
 */
export function createEnduroPodiumEntries(withLogos: boolean): PodiumEntry[] {
  const sinuelo: PodiumEntry = {
    position: 1,
    carNumber: 51,
    teamName: 'Sinuelo',
    schoolName: 'FAHOR',
    laps: 64,
    status: 'running',
  };
  const komiketo: PodiumEntry = {
    position: 2,
    carNumber: 10,
    teamName: 'Equipe Komiketo Baja',
    schoolName: 'UFSJ',
    laps: 60,
    status: 'running',
  };
  const patoBaja: PodiumEntry = {
    position: 3,
    carNumber: 47,
    teamName: 'Pato Baja',
    schoolName: 'UTFPR-PB',
    laps: 60,
    status: 'running',
  };
  if (!withLogos) {
    return [sinuelo, komiketo, patoBaja];
  }
  return [
    { ...sinuelo, logoUrl: sinueloLogoUrl, logoOnLightPlate: false },
    { ...komiketo, logoUrl: komiketoBajaLogoUrl, logoOnLightPlate: true },
    { ...patoBaja, logoUrl: patoBajaLogoUrl, logoOnLightPlate: true },
  ];
}

/** The enduro's podium, the design's podium-passo pages: the title, the event, the logos. */
export function createEnduroPodium(withLogos: boolean): PodiumData {
  return {
    entries: createEnduroPodiumEntries(withLogos),
    title: ptBR.defaultTitle,
    eventLine: ptBR.preview.sampleEventLine,
  };
}

/**
 * The overall standings' first three with a tie for first, as the standings shape lists
 * them (rank and points): made from the real top three (Baja UFMG 921,80, Equipe FEI Baja
 * 903,48, Equipe Komiketo Baja 891,59) with FEI's total raised to Baja UFMG's, so both
 * share rank 1 and the next team is 3rd. Baja UFMG and FEI have no logo in the sample.
 */
export function createOverallPodiumWithATieForFirst(): PodiumData {
  return {
    entries: [
      { rank: 1, carNumber: 2, teamName: 'Baja UFMG', schoolName: 'UFMG', points: 921.8 },
      { rank: 1, carNumber: 1, teamName: 'Equipe FEI Baja', schoolName: 'FEI', points: 921.8 },
      {
        rank: 3,
        carNumber: 10,
        teamName: 'Equipe Komiketo Baja',
        schoolName: 'UFSJ',
        points: 891.59,
        logoUrl: komiketoBajaLogoUrl,
        logoOnLightPlate: true,
      },
    ],
    title: ptBR.preview.overallTitle,
  };
}

/** Reads the data from an address query string (location.search); never throws. */
export function choosePreviewData(addressQuery: string): PreviewDataChoice {
  const searchParameters = new URLSearchParams(addressQuery);
  const dataText = searchParameters.get('data');
  if (dataText === null) {
    if (searchParameters.get('tie') === 'on') {
      return { isReadable: true, data: createOverallPodiumWithATieForFirst() };
    }
    const withLogos = searchParameters.get('logos') !== 'off';
    return { isReadable: true, data: createEnduroPodium(withLogos) };
  }

  try {
    const data: unknown = JSON.parse(dataText);
    return { isReadable: true, data };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}

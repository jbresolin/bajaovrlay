/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or one of the
 * sample matches "a seguir": `?match=logos|no-logos|one-logo|started|longest-names|empty`
 * (the second semifinal with both teams' logos, with none, with Corisco's only, at 1 × 0,
 * two of the longest team names of the event, and an empty slot), `logos` when none is
 * named. Whether the data is valid is left to the graphic's own load(), so the preview
 * shows exactly the answer a renderer would get.
 *
 * The teams are real teams of the 30ª Competição (docs/design/sample-data.json): Corisco
 * Baja (car 32, UPE) and Equipe Cactus Baja (car 13, UFERSA-Mos). Their logos are the
 * design's sample files (docs/design/sample_data/logos/teams/32.webp and 13.webp), copied
 * into this package and imported through Vite so they land in dist/ with the preview; on
 * air a logo is a `/media/<id>` the server serves.
 */
import cactusLogoUrl from '../preview-images/cactus-baja-logo.webp';
import coriscoLogoUrl from '../preview-images/corisco-baja-logo.webp';
import type { MatchCardData } from './matchCardModel.js';
import { ptBR } from './ptBR.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** The second semifinal "a seguir" with neither logo: each side shows its car number. */
function buildSemifinalWithoutLogos(): MatchCardData {
  return {
    roundName: 'Semifinal',
    bestOf: 3,
    carANumber: 32,
    carATeamName: 'Corisco Baja',
    carASchoolName: 'UPE',
    carACity: 'Recife',
    carAState: 'PE',
    carBNumber: 13,
    carBTeamName: 'Equipe Cactus Baja',
    carBSchoolName: 'UFERSA-Mos',
    carBCity: 'Mossoró',
    carBState: 'RN',
  };
}

/** The same match with both teams' logos. */
function buildSemifinalWithLogos(): MatchCardData {
  return {
    ...buildSemifinalWithoutLogos(),
    carALogoUrl: coriscoLogoUrl,
    carBLogoUrl: cactusLogoUrl,
  };
}

/** Each sample match by the name the address gives it. */
function buildSampleMatch(matchName: string): MatchCardData {
  switch (matchName) {
    case 'no-logos':
      return buildSemifinalWithoutLogos();
    case 'one-logo':
      return { ...buildSemifinalWithoutLogos(), carALogoUrl: coriscoLogoUrl };
    case 'started':
      return { ...buildSemifinalWithLogos(), carAWins: 1, carBWins: 0 };
    case 'longest-names':
      return {
        roundName: 'Disputa de 3º lugar',
        bestOf: 3,
        carANumber: 77,
        carATeamName: 'Equipe de Baja SAE da Universidade Tecnológica Federal do Paraná',
        carASchoolName: 'UTFPR - Cornélio Procópio',
        carACity: 'Cornélio Procópio',
        carAState: 'PR',
        carBNumber: 88,
        carBTeamName: 'Equipe Fluminense de Baja do Instituto Federal Fluminense',
        carBSchoolName: 'Instituto Federal Fluminense - IFF - Campus Itaperuna',
        carBCity: 'Itaperuna',
        carBState: 'RJ',
      };
    case 'empty':
      return {};
    default:
      return buildSemifinalWithLogos();
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
  return { isReadable: true, data: buildSampleMatch(searchParameters.get('match') ?? 'logos') };
}

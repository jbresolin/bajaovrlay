/**
 * The 30ª Competição's 17 sponsors with their real logos, the sample the sponsor roll's and
 * the intermission's preview.html show (the design's `sponsor-roll` and `intermission-board`
 * pages), and the one list of them the tests use too (the30thCompetitionSponsors.testSupport).
 *
 * The logos are files of the kit (copies of docs/design/sample_data/logos/sponsors), imported
 * through Vite so they land in each graphic's dist/ with its preview only. Every one of them
 * comes on its own light box but Vetore's, hence the plate choice of each (the design's
 * logos.json). The order is the server's (round order, then name), as the entity list sends it.
 */
import type { SponsorLevel } from '@bajaovrlay/shared/sponsorLevels';

import boschLogoUrl from '../preview-sponsor-logos/bosch.webp';
import certiLogoUrl from '../preview-sponsor-logos/certi.webp';
import cnhLogoUrl from '../preview-sponsor-logos/cnh.webp';
import criciumaLogoUrl from '../preview-sponsor-logos/criciuma.webp';
import himixLogoUrl from '../preview-sponsor-logos/himix.webp';
import horseLogoUrl from '../preview-sponsor-logos/horse.webp';
import marcopoloLogoUrl from '../preview-sponsor-logos/marcopolo.webp';
import osakiLogoUrl from '../preview-sponsor-logos/osaki.webp';
import renaultLogoUrl from '../preview-sponsor-logos/renault.webp';
import rodonunesLogoUrl from '../preview-sponsor-logos/rodonunes.webp';
import saeLogoUrl from '../preview-sponsor-logos/sae.webp';
import sae4mobilityLogoUrl from '../preview-sponsor-logos/sae4mobility.webp';
import satcLogoUrl from '../preview-sponsor-logos/satc.webp';
import schulzLogoUrl from '../preview-sponsor-logos/schulz.webp';
import segulaLogoUrl from '../preview-sponsor-logos/segula.webp';
import trpLogoUrl from '../preview-sponsor-logos/trp.webp';
import vetoreLogoUrl from '../preview-sponsor-logos/vetore.webp';

/** One sponsor as an entity list of sponsors gives it to a graphic. */
export type SampleSponsor = {
  name: string;
  level: SponsorLevel;
  logoUrl: string;
  logoOnLightPlate: boolean;
  rollWeight: number;
};

/** One sponsor of the sample, on the light plate unless the design says its logo is light. */
function buildSponsor(
  name: string,
  level: SponsorLevel,
  logoUrl: string,
  logoOnLightPlate = true,
): SampleSponsor {
  return { name, level, logoUrl, logoOnLightPlate, rollWeight: 5 };
}

/** The 17 in the server's order, each with its logo: Diamante 2, Ouro 9, Apoio 5, Realização 1. */
export function createThe30thCompetitionSponsorsSample(): SampleSponsor[] {
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

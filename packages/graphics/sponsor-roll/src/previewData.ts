/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or the design's
 * sample (the `sponsor-roll` and `sponsor-roll-canto` pages: the 30ª Competição's real 17
 * sponsors with their logos) in the layout `?layout=` names (`fullscreen` unless it says
 * `corner`). Whether the data is valid is left to the graphic's own load(). The stage behind
 * it is the kit's `?stage=grey|black`.
 *
 * The logos are files of this package (copies of docs/design/sample_data/logos/sponsors),
 * imported through Vite so they land in dist/ with the preview. Every one of them comes on
 * its own light box but Vetore's, hence the plate choice of each (the design's logos.json).
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
import { ptBR } from './ptBR.js';
import type { SponsorRollData, SponsorRollLayout, SponsorRollSponsor } from './sponsorRollModel.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** One sponsor of the sample, on the light plate unless the design says its logo is light. */
function buildSponsor(
  name: string,
  level: SponsorRollSponsor['level'],
  logoUrl: string,
  logoOnLightPlate = true,
): SponsorRollSponsor {
  return { name, level, logoUrl, logoOnLightPlate, rollWeight: 5 };
}

/** The 30ª Competição's 17 sponsors in the server's order (round order, then name). */
export function createThe30thCompetitionSponsors(): SponsorRollSponsor[] {
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

/** Builds the design's roll in a layout. */
export function createSponsorRollSample(layout: SponsorRollLayout): SponsorRollData {
  return { layout, sponsors: createThe30thCompetitionSponsors(), eventWord: 'ENDURO' };
}

/** Reads the data from an address query string (location.search); never throws. */
export function choosePreviewData(addressQuery: string): PreviewDataChoice {
  const searchParameters = new URLSearchParams(addressQuery);
  const dataText = searchParameters.get('data');
  if (dataText === null) {
    const layout = searchParameters.get('layout') === 'corner' ? 'corner' : 'fullscreen';
    return { isReadable: true, data: createSponsorRollSample(layout) };
  }
  try {
    const data: unknown = JSON.parse(dataText);
    return { isReadable: true, data };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}

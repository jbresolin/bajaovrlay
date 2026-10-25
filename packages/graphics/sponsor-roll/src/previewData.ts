/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or the design's
 * sample (the `sponsor-roll` and `sponsor-roll-canto` pages: the 30ª Competição's real 17
 * sponsors with their logos) in the layout `?layout=` names (`fullscreen` unless it says
 * `corner`). Whether the data is valid is left to the graphic's own load(). The stage behind
 * it is the kit's `?stage=grey|black`.
 *
 * The 17 and their logos are the kit's sample (the30thCompetitionSponsorsSample), shared
 * with the intermission's preview.
 */
import { createThe30thCompetitionSponsorsSample } from '@bajaovrlay/graphics-kit/the30thCompetitionSponsorsSample';

import { ptBR } from './ptBR.js';
import type { SponsorRollData, SponsorRollLayout } from './sponsorRollModel.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** Builds the design's roll in a layout. */
export function createSponsorRollSample(layout: SponsorRollLayout): SponsorRollData {
  return { layout, sponsors: createThe30thCompetitionSponsorsSample(), eventWord: 'ENDURO' };
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

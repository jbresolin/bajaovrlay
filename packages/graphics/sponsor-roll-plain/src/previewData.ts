/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or the 30ª
 * Competição's sponsors with their real logos (the kit's sample, shared with the sponsor
 * roll's preview). `?sponsor=<name>` keeps that one sponsor alone, so a screenshot is taken
 * before any turn ("Criciúma" for the short "APOIO", "Bosch" for the longest heading and the
 * light plate, "Vetore" for a light logo with no plate), and `?corner=` places the card.
 * Whether the data is valid is left to the graphic's own load(), so the preview shows
 * exactly the answer a renderer would get. The stage behind it is the kit's `?stage=`.
 */
import { createThe30thCompetitionSponsorsSample } from '@bajaovrlay/graphics-kit/the30thCompetitionSponsorsSample';

import { ptBR } from './ptBR.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** Builds the sample roll with what the address asks for; a name not in it gives no sponsor. */
function buildSampleFromAddress(searchParameters: URLSearchParams): Record<string, unknown> {
  const sponsorName = searchParameters.get('sponsor');
  const everySponsor = createThe30thCompetitionSponsorsSample();
  const sponsors =
    sponsorName === null
      ? everySponsor
      : everySponsor.filter((sponsor) => sponsor.name === sponsorName);
  const sample: Record<string, unknown> = { sponsors };
  const corner = searchParameters.get('corner');
  if (corner !== null) {
    sample.corner = corner;
  }
  return sample;
}

/** Reads the data from an address query string (location.search); never throws. */
export function choosePreviewData(addressQuery: string): PreviewDataChoice {
  const searchParameters = new URLSearchParams(addressQuery);
  const dataText = searchParameters.get('data');
  if (dataText === null) {
    return { isReadable: true, data: buildSampleFromAddress(searchParameters) };
  }
  try {
    const data: unknown = JSON.parse(dataText);
    return { isReadable: true, data };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}

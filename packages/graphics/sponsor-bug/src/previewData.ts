/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or the bug of
 * the 30ª Competição's enduro (the design's sponsor-bug page: "ENDURO", "Apresentado por"
 * over Bosch's logo, which comes on its own white box, hence the plate) with the parts the
 * address switches off (`?sponsor=off`, `?word=off`, `?plate=off`). Whether the data is
 * valid is left to the graphic's own load(), so the preview shows exactly the answer a
 * renderer would get. The stage behind it is the kit's `?stage=grey|black`.
 *
 * The logo is a file of this package (docs/design/sample_data/logos/sponsors/bosch.webp),
 * imported through Vite so it lands in dist/ with the preview.
 */
import boschLogoUrl from '../preview-images/bosch-logo.webp';
import { ptBR } from './ptBR.js';
import type { SponsorBugData } from './sponsorBugModel.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** Which optional parts the sample shows. */
export type SampleParts = {
  hasSponsor: boolean;
  hasEventWord: boolean;
  isSponsorLogoOnLightPlate: boolean;
};

/** Every part on and the logo on its plate: the design's sponsor-bug page. */
export const everySamplePartOn: SampleParts = {
  hasSponsor: true,
  hasEventWord: true,
  isSponsorLogoOnLightPlate: true,
};

/** Builds the enduro's bug with the chosen parts. */
export function createEnduroBugSample(parts: SampleParts): SponsorBugData {
  const sample: SponsorBugData = {
    caption: 'Apresentado por',
    sponsorLogoOnLightPlate: parts.isSponsorLogoOnLightPlate,
  };
  if (parts.hasEventWord) {
    sample.eventWord = 'ENDURO';
  }
  if (parts.hasSponsor) {
    sample.sponsorLogoUrl = boschLogoUrl;
  }
  return sample;
}

/** Reads the three switches from the address; a part is on unless the address says `off`. */
function readSamplePartsFromAddress(searchParameters: URLSearchParams): SampleParts {
  return {
    hasSponsor: searchParameters.get('sponsor') !== 'off',
    hasEventWord: searchParameters.get('word') !== 'off',
    isSponsorLogoOnLightPlate: searchParameters.get('plate') !== 'off',
  };
}

/** Reads the data from an address query string (location.search); never throws. */
export function choosePreviewData(addressQuery: string): PreviewDataChoice {
  const searchParameters = new URLSearchParams(addressQuery);
  const dataText = searchParameters.get('data');
  if (dataText === null) {
    const parts = readSamplePartsFromAddress(searchParameters);
    return { isReadable: true, data: createEnduroBugSample(parts) };
  }

  try {
    const data: unknown = JSON.parse(dataText);
    return { isReadable: true, data };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}

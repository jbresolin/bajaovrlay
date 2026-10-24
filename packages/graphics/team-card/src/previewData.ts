/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or car 7 of the
 * 30ª Competição's real teams (Reptiles Baja PUC-Rio, docs/design/sample_data) with the
 * parts the address switches on or off (`?photo=off`, `?logo=off`, `?city=off`,
 * `?plate=off`); and the stage behind it (`?stage=grey|black`, the design's screenshot
 * backgrounds, or the footage stand-in). Whether the data is valid is left to the graphic's
 * own load(), so the preview shows exactly the answer a renderer would get.
 *
 * The two images are files of this package, imported through Vite so they land in dist/
 * with the preview: the team's real logo (sample_data/logos/teams/7.webp, black on clear,
 * hence the plate) and a stream frame standing in for a car photo (docs/brand/frames/3.jpg,
 * as the design's own mock-up does; no car photos were handed over).
 */
import carPhotoStandInUrl from '../preview-images/car-photo-stand-in.jpg';
import reptilesLogoUrl from '../preview-images/reptiles-baja-logo.webp';
import { ptBR } from './ptBR.js';
import type { TeamCardData } from './teamCardModel.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** Which optional parts the sample shows: one of the eight combinations, and the plate. */
export type SampleParts = {
  hasPhoto: boolean;
  hasLogo: boolean;
  hasCity: boolean;
  isLogoOnLightPlate: boolean;
};

/** Every part on and the logo on its plate: the design's team-card page. */
export const everySamplePartOn: SampleParts = {
  hasPhoto: true,
  hasLogo: true,
  hasCity: true,
  isLogoOnLightPlate: true,
};

/** Builds car 7, Reptiles Baja PUC-Rio (PUC-Rio, Rio de Janeiro · RJ), with the chosen parts. */
export function createReptilesSample(parts: SampleParts): TeamCardData {
  const sample: TeamCardData = {
    carNumber: 7,
    teamName: 'Reptiles Baja PUC-Rio',
    schoolName: 'PUC-Rio',
    logoOnLightPlate: parts.isLogoOnLightPlate,
  };
  if (parts.hasPhoto) {
    sample.carPhotoUrl = carPhotoStandInUrl;
  }
  if (parts.hasLogo) {
    sample.logoUrl = reptilesLogoUrl;
  }
  if (parts.hasCity) {
    sample.city = 'Rio de Janeiro';
    sample.state = 'RJ';
  }
  return sample;
}

/** Reads the four switches from the address; a part is on unless the address says `off`. */
function readSamplePartsFromAddress(searchParameters: URLSearchParams): SampleParts {
  return {
    hasPhoto: searchParameters.get('photo') !== 'off',
    hasLogo: searchParameters.get('logo') !== 'off',
    hasCity: searchParameters.get('city') !== 'off',
    isLogoOnLightPlate: searchParameters.get('plate') !== 'off',
  };
}

/** Reads the data from an address query string (location.search); never throws. */
export function choosePreviewData(addressQuery: string): PreviewDataChoice {
  const searchParameters = new URLSearchParams(addressQuery);
  const dataText = searchParameters.get('data');
  if (dataText === null) {
    const parts = readSamplePartsFromAddress(searchParameters);
    return { isReadable: true, data: createReptilesSample(parts) };
  }

  try {
    const data: unknown = JSON.parse(dataText);
    return { isReadable: true, data };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}

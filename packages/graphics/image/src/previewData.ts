/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or the white
 * Baja SAE Brasil mark (335x256 px) standing in for an operator's image, with what the
 * address asks for: `?position=<anchor>`, `?width=<px>`, `?height=<px>`, `?x=<px>`,
 * `?y=<px>`, `?opacity=<percent>`, `?entrance=fade|none`, `?background=%23rrggbb` (the
 * "#" written as %23 in an address), `?margin=<px>`, and `?image=missing` for an
 * address with no file behind it (the failed-file case). Whether the data is valid is left
 * to the graphic's own load(), so the preview shows exactly the answer a renderer would
 * get; `?width=5000` shows the 400.
 *
 * The mark is the theme's own file, imported through Vite so it lands in dist/ with the
 * preview; on air the image is a `/media/<id>` the server serves.
 */
import markAddress from '@bajaovrlay/theme/brand/logo-branca.png';

import { ptBR } from './ptBR.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** An address on the server's media route with no file behind it: a 404 in the preview. */
export const missingImageAddress = '/media/imagem-que-nao-existe';

/** The address's names for the text fields, and the data field each one fills. */
const textFieldsOfTheAddress = [
  { addressName: 'position', fieldName: 'position' },
  { addressName: 'entrance', fieldName: 'entrance' },
  { addressName: 'background', fieldName: 'backgroundColor' },
] as const;

/** The address's names for the number fields, and the data field each one fills. */
const numberFieldsOfTheAddress = [
  { addressName: 'width', fieldName: 'widthPx' },
  { addressName: 'height', fieldName: 'heightPx' },
  { addressName: 'x', fieldName: 'offsetXPx' },
  { addressName: 'y', fieldName: 'offsetYPx' },
  { addressName: 'opacity', fieldName: 'opacityPercent' },
  { addressName: 'margin', fieldName: 'marginPx' },
] as const;

/** Builds the sample image with what the address asks for; anything left out keeps its default. */
function buildSampleFromAddress(searchParameters: URLSearchParams): Record<string, unknown> {
  const isImageMissing = searchParameters.get('image') === 'missing';
  const sample: Record<string, unknown> = {
    imageUrl: isImageMissing ? missingImageAddress : markAddress,
  };
  for (const { addressName, fieldName } of textFieldsOfTheAddress) {
    const text = searchParameters.get(addressName);
    if (text !== null) {
      sample[fieldName] = text;
    }
  }
  for (const { addressName, fieldName } of numberFieldsOfTheAddress) {
    const text = searchParameters.get(addressName);
    if (text !== null) {
      sample[fieldName] = Number(text);
    }
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

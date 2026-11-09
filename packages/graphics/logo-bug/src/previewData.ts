/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or the white
 * Baja SAE Brasil mark standing in for a channel's logo, with what the address asks for:
 * `?corner=top-left|top-right|bottom-left|bottom-right`, `?height=<px>`,
 * `?opacity=<percent>`, and `?image=missing` for an address with no file behind it (the
 * failed-image case). Whether the data is valid is left to the graphic's own load(), so
 * the preview shows exactly the answer a renderer would get; `?height=500` shows the 400.
 *
 * The mark is the theme's own file, imported through Vite so it lands in dist/ with the
 * preview; on air the logo is a `/media/<id>` the server serves.
 */
import markAddress from '@bajaovrlay/theme/brand/logo-branca.png';

import { ptBR } from './ptBR.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** An address on the server's media route with no file behind it: a 404 in the preview. */
export const missingLogoAddress = '/media/logo-que-nao-existe';

/** Reads a whole number from the address, or undefined when it is not there. */
function readNumberFromAddress(
  searchParameters: URLSearchParams,
  name: string,
): number | undefined {
  const text = searchParameters.get(name);
  if (text === null) {
    return undefined;
  }
  return Number(text);
}

/** Builds the sample logo with what the address asks for; anything left out keeps its default. */
function buildSampleFromAddress(searchParameters: URLSearchParams): Record<string, unknown> {
  const isImageMissing = searchParameters.get('image') === 'missing';
  const sample: Record<string, unknown> = {
    logoUrl: isImageMissing ? missingLogoAddress : markAddress,
  };
  const corner = searchParameters.get('corner');
  if (corner !== null) {
    sample.corner = corner;
  }
  const heightPx = readNumberFromAddress(searchParameters, 'height');
  if (heightPx !== undefined) {
    sample.heightPx = heightPx;
  }
  const opacityPercent = readNumberFromAddress(searchParameters, 'opacity');
  if (opacityPercent !== undefined) {
    sample.opacityPercent = opacityPercent;
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

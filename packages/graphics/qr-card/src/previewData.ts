/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or the design's
 * card (qr-card.html: "Acompanhe os resultados", resultados.bajasaebrasil.net), with
 * `?address=longest` for an address of exactly the longest length, the largest code the card
 * draws; and the stage behind it (`?stage=grey|black`, the design's screenshot backgrounds,
 * or the footage stand-in). Whether the data is valid is left to the graphic's own load(),
 * so the preview shows exactly the answer a renderer would get.
 */
import { ptBR } from './ptBR.js';
import { longestAddressLength, type QrCardData } from './qrCardModel.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** The design's card: the results page of the 30ª Competição. */
export function createResultsSample(): QrCardData {
  return {
    callToAction: 'Acompanhe os resultados',
    address: 'resultados.bajasaebrasil.net',
  };
}

/**
 * Builds an address of exactly `longestAddressLength` characters that reads like a real one:
 * the results page with a long tracking query, padded with the session's name repeated.
 */
export function buildLongestSampleAddress(): string {
  const start = 'https://resultados.bajasaebrasil.net/2026/enduro?sessao=';
  const filler = 'enduro-de-resistencia-';
  let address = start;
  while (address.length < longestAddressLength) {
    address += filler;
  }
  return address.slice(0, longestAddressLength);
}

/** The design's card with the longest address the card takes. */
export function createLongestAddressSample(): QrCardData {
  return { callToAction: 'Acompanhe os resultados', address: buildLongestSampleAddress() };
}

/** Reads the data from an address query string (location.search); never throws. */
export function choosePreviewData(addressQuery: string): PreviewDataChoice {
  const searchParameters = new URLSearchParams(addressQuery);
  const dataText = searchParameters.get('data');
  if (dataText === null) {
    const isLongestAsked = searchParameters.get('address') === 'longest';
    const data = isLongestAsked ? createLongestAddressSample() : createResultsSample();
    return { isReadable: true, data };
  }

  try {
    const data: unknown = JSON.parse(dataText);
    return { isReadable: true, data };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}

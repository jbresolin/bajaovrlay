/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or the design's
 * sample (the `countdown` and `countdown-tela-cheia` pages: the Enduro de Resistência,
 * 23 min 45 s from "now", at the 30ª Competição) in the layout `?layout=` names (`card`
 * unless it says `fullscreen`). Whether the data is valid is left to the graphic's own
 * load(), so the preview shows exactly the answer a renderer would get. The stage behind it
 * is the kit's `?stage=grey|black`. The screenshots fix the page's clock, so "now" and the
 * count are the same on every run.
 */
import type { CountdownData, CountdownLayout } from './countdownModel.js';
import { ptBR } from './ptBR.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** How long before the start the sample opens: the design's 23:45. */
export const sampleTimeBeforeTheStartMs = (23 * 60 + 45) * 1000;

/** Builds the enduro's countdown in a layout, the start 23:45 after `nowMs`. */
export function createEnduroCountdownSample(layout: CountdownLayout, nowMs: number): CountdownData {
  return {
    layout,
    sessionName: 'Enduro de Resistência',
    startsAtMs: nowMs + sampleTimeBeforeTheStartMs,
    eventLine: '30ª Competição Baja SAE Brasil',
    dateLine: 'domingo, 30 de março de 2025',
  };
}

/** Reads the layout from the address: `fullscreen` when it says so, the card otherwise. */
export function readSampleLayoutFromAddress(addressQuery: string): CountdownLayout {
  const searchParameters = new URLSearchParams(addressQuery);
  return searchParameters.get('layout') === 'fullscreen' ? 'fullscreen' : 'card';
}

/** Reads the data from an address query string (location.search) at `nowMs`; never throws. */
export function choosePreviewData(addressQuery: string, nowMs: number): PreviewDataChoice {
  const searchParameters = new URLSearchParams(addressQuery);
  const dataText = searchParameters.get('data');
  if (dataText === null) {
    const layout = readSampleLayoutFromAddress(addressQuery);
    return { isReadable: true, data: createEnduroCountdownSample(layout, nowMs) };
  }

  try {
    const data: unknown = JSON.parse(dataText);
    return { isReadable: true, data };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}

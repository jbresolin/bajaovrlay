/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or the design's
 * sample (the `sessions-board` page: Sunday's six slots of the 30ª Competição, the third,
 * "Alinhamento do enduro", in progress). The sample's slots are placed around "now", so
 * the preview always opens with two slots done, one in progress and three to come; the
 * screenshots pass the design's real times with `?data=` and fix the page's clock. Whether
 * the data is valid is left to the graphic's own load(). The stage behind it is the kit's
 * `?stage=grey|black`.
 */
import { ptBR } from './ptBR.js';
import type { SessionsBoardData, SessionsBoardSlot } from './sessionsBoardModel.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/** Sunday's six sessions and when each starts, in minutes from the one in progress (09:15). */
const sundaySessionsAroundTheAlignment: Array<[string, string, string, number]> = [
  ['abertura', 'Abertura do box', 'other', -105],
  ['briefing', 'Briefing das equipes', 'other', -45],
  ['alinhamento', 'Alinhamento do enduro', 'other', 0],
  ['enduro', 'Enduro de Resistência', 'enduro', 45],
  ['intervalo', 'Intervalo', 'other', 315],
  ['premiacao', 'Cerimônia de premiação', 'other', 405],
];

/**
 * Builds Sunday's six slots around the alignment's start, each slot running until the next
 * starts (none has an end of its own).
 */
export function createSundaySlots(alignmentStartsAtMs: number): SessionsBoardSlot[] {
  return sundaySessionsAroundTheAlignment.map(([slotId, sessionName, sessionKind, minutes]) => ({
    slotId,
    sessionName,
    sessionKind,
    startsAtMs: alignmentStartsAtMs + minutes * 60_000,
  }));
}

/** Builds the design's board with the alignment five minutes in at `nowMs`. */
export function createSundaySessionsBoardSample(nowMs: number): SessionsBoardData {
  return {
    title: 'PROGRAMAÇÃO DO DIA',
    eventLine: '30ª Competição Baja SAE Brasil',
    dateLine: 'domingo, 30 de março de 2025',
    slots: createSundaySlots(nowMs - 5 * 60_000),
  };
}

/** Reads the data from an address query string (location.search) at `nowMs`; never throws. */
export function choosePreviewData(addressQuery: string, nowMs: number): PreviewDataChoice {
  const dataText = new URLSearchParams(addressQuery).get('data');
  if (dataText === null) {
    return { isReadable: true, data: createSundaySessionsBoardSample(nowMs) };
  }
  try {
    const data: unknown = JSON.parse(dataText);
    return { isReadable: true, data };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}

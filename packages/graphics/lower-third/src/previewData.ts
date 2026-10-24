/**
 * Chooses what preview.html shows: the JSON in `?data=` when there is one, or the team
 * captain sample; and the stage behind it from `?stage=` (grey, black, or the footage
 * stand-in). The samples are also what the preview's buttons send. Whether the data is
 * valid is left to the graphic's own load(), so the preview shows exactly the answer a
 * renderer would get.
 */
import type { LowerThirdData } from './lowerThirdModel.js';
import { ptBR } from './ptBR.js';

/** Either data to load, or a pt-BR sentence saying why the address could not be read. */
export type PreviewDataChoice =
  { isReadable: true; data: unknown } | { isReadable: false; problem: string };

/**
 * Builds the team captain sample: the design's own lower third, with role and team line.
 * The keys are all there so a button that sends it fills every field again.
 */
export function createTeamCaptainSample(): LowerThirdData {
  return { name: 'Mariana Costa', role: 'Capitã da equipe', teamLine: 'Baja UFMG · UFMG' };
}

/** Builds the narrator sample, as Cadastros gives it: a name and a role, no team line. */
export function createNarratorSample(): LowerThirdData {
  return { name: 'Ana Paula Ribeiro', role: 'Narradora', teamLine: undefined };
}

/**
 * Builds the name-only sample. The role and team line are named as undefined, which is
 * how the renderer clears a field, so the button empties them on a lower third on air.
 */
export function createNameOnlySample(): LowerThirdData {
  return { name: 'Ana Paula Ribeiro', role: undefined, teamLine: undefined };
}

/** Reads `?data=` from an address query string (location.search); never throws. */
export function choosePreviewData(addressQuery: string): PreviewDataChoice {
  const dataText = new URLSearchParams(addressQuery).get('data');
  if (dataText === null) {
    return { isReadable: true, data: createTeamCaptainSample() };
  }

  try {
    const data: unknown = JSON.parse(dataText);
    return { isReadable: true, data };
  } catch {
    return { isReadable: false, problem: ptBR.preview.unreadableAddressData };
  }
}

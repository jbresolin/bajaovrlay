/**
 * pt-BR catalog of the flag words, the only on-air words the kit owns: the race clock's
 * band and the strip's and the ticker's flag pill must read the same word for a flag, so
 * it is written once here rather than in each graphic's catalog.
 */
import type { FlagState } from './raceClockReading.js';

/** The on-air word of each flag state, in caps as Bebas Neue draws them. */
export const flagWordsInPortuguese: Record<FlagState, string> = {
  pre: 'PRÉ-LARGADA',
  green: 'VERDE',
  yellow: 'AMARELA',
  red: 'VERMELHA',
  checkered: 'QUADRICULADA',
  finished: 'ENCERRADA',
};

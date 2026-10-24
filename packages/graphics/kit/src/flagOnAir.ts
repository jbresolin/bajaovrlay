/**
 * How a flag state is drawn on air, the same in the race clock's flag band and in the flag
 * pill of the lower strip's and the message ticker's clock block: the colours (a
 * `data-flag-state` the graphic's styles read), the word written on it, and its accessible
 * name. The checkered flag shows the pattern alone, no word (João's ruling at the gate on
 * PR #19); its word is only the accessible name.
 */
import { flagWordsInPortuguese } from './ptBRFlagWords.js';
import type { FlagState } from './raceClockReading.js';

/** What a band or a pill shows for one flag state. */
export type FlagOnAir = {
  flagState: FlagState;
  /** The word written on the band or pill; empty for the checkered flag. */
  wordShown: string;
  /** The flag's name for assistive technology, always the word. */
  accessibleName: string;
};

/** Describes how a flag state is drawn on air. */
export function describeFlagOnAir(flagState: FlagState): FlagOnAir {
  const flagWord = flagWordsInPortuguese[flagState];
  const isPatternAlone = flagState === 'checkered';
  return {
    flagState,
    wordShown: isPatternAlone ? '' : flagWord,
    accessibleName: flagWord,
  };
}

/**
 * Dresses one element as the flag: its `data-flag-state`, its accessible name and the word
 * in `wordElement`, each written only when it differs, so a reading that keeps the flag
 * touches nothing.
 */
export function dressElementAsFlag(
  flagElement: HTMLElement,
  wordElement: HTMLElement,
  flagState: FlagState,
): void {
  const flagOnAir = describeFlagOnAir(flagState);
  if (flagElement.dataset.flagState !== flagState) {
    flagElement.dataset.flagState = flagState;
  }
  if (flagElement.getAttribute('aria-label') !== flagOnAir.accessibleName) {
    flagElement.setAttribute('aria-label', flagOnAir.accessibleName);
  }
  if (wordElement.textContent !== flagOnAir.wordShown) {
    wordElement.textContent = flagOnAir.wordShown;
  }
}

import type { BracketMatchFocus } from '@bajaovrlay/shared';

/**
 * The focuses with one source's focus replaced by the one given, in its place, or added
 * at the end when the source had none: the slice keeps one focus per source, in the
 * order the sources were first chosen for, so a page lists them in a stable order.
 */
export function replaceFocusOfTheSource(
  focuses: readonly BracketMatchFocus[],
  focusAfter: BracketMatchFocus,
): BracketMatchFocus[] {
  const hadAFocus = focuses.some((focus) => focus.sourceId === focusAfter.sourceId);
  if (!hadAFocus) {
    return [...focuses, focusAfter];
  }
  return focuses.map((focus) => (focus.sourceId === focusAfter.sourceId ? focusAfter : focus));
}

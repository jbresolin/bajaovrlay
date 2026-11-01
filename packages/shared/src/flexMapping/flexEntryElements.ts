/**
 * The elements a list shape's entries are built from: the list at `entriesPath`, or, with
 * `nestedEntriesPath` (BAJAOVRLAY-53), every element of the list inside each element of
 * it, each with its outer element for the rules that read `fromParent`. So a tournament's
 * `rounds[].matches[]` gives one entry per match, in order, round after round.
 */
import type { FlexShapeMapping } from './flexMappingConfig.js';
import { ptBRFlexMapping } from './ptBRFlexMapping.js';
import { readValueAtPath } from './valuePath.js';

/** One element an entry is built from, and its outer element when the list is nested. */
export type EntryElement = { element: unknown; parentElement: unknown };

/**
 * The elements of a list shape, or a problem line when there is no list at all (an empty
 * tower would look like a race with no cars); an outer element with no inner list is a
 * problem of its own, and its inner elements are simply none.
 */
export type EntryElementsListing =
  | { ok: true; entryElements: EntryElement[]; problemLines: string[] }
  | { ok: false; problemLine: string };

/** Lists the elements a list shape's entries are built from. */
export function listEntryElements(
  mapping: FlexShapeMapping,
  entriesPath: string,
  response: unknown,
  shapeName: string,
): EntryElementsListing {
  const lines = ptBRFlexMapping.problemLines;
  const listReading = readValueAtPath(response, entriesPath);
  if (listReading.outcome === 'pathRefused') {
    return { ok: false, problemLine: lines.atShape(shapeName, listReading.reason) };
  }
  if (listReading.outcome === 'nothingThere' || !Array.isArray(listReading.value)) {
    return {
      ok: false,
      problemLine: lines.noListAtPath(shapeName, entriesPath, mapping.requestId),
    };
  }
  const outerElements: unknown[] = listReading.value;
  const nestedEntriesPath = mapping.nestedEntriesPath;
  if (nestedEntriesPath === undefined) {
    const entryElements = outerElements.map((element) => ({ element, parentElement: undefined }));
    return { ok: true, entryElements, problemLines: [] };
  }

  const entryElements: EntryElement[] = [];
  const problemLines: string[] = [];
  outerElements.forEach((outerElement, outerIndex) => {
    const innerReading = readValueAtPath(outerElement, nestedEntriesPath);
    if (innerReading.outcome !== 'found' || !Array.isArray(innerReading.value)) {
      problemLines.push(
        lines.noInnerListInOuterElement(shapeName, outerIndex + 1, entriesPath, nestedEntriesPath),
      );
      return;
    }
    const innerElements: unknown[] = innerReading.value;
    for (const element of innerElements) {
      entryElements.push({ element, parentElement: outerElement });
    }
  });
  return { ok: true, entryElements, problemLines };
}

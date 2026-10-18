/**
 * The numbers of the source forms travel as the text of their fields ("0,5", "240"),
 * which is what an input holds. These two functions are the one place that text becomes
 * a number and back, so every field of both forms reads a decimal comma the same way.
 */

/**
 * Reads a number from a field's text, with a decimal comma or point ("0,5" and "0.5").
 * Returns NaN for blank text, which every schema refuses, so an emptied field is never
 * read as zero.
 */
export function readNumberFromFieldText(fieldText: string): number {
  const trimmedText = fieldText.trim();
  if (trimmedText === '') {
    return Number.NaN;
  }
  return Number(trimmedText.replace(',', '.'));
}

/** Writes a number for a field, with a decimal comma as a Brazilian operator types it. */
export function writeNumberAsFieldText(value: number): string {
  return String(value).replace('.', ',');
}

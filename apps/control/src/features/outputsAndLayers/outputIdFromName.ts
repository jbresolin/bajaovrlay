/** The longest output id the server accepts (OutputIdSchema in @bajaovrlay/shared). */
const longestOutputIdLength = 30;

/**
 * The address the new-output form suggests while the operator types a name: lower case,
 * accents dropped, every run of other characters a single hyphen, no hyphen at either
 * end, at most 30 characters. "PiP" gives "pip", "Câmera 2" gives "camera-2". Only a
 * suggestion: the operator may type another address, and the server checks it.
 */
export function suggestOutputIdFromName(outputName: string): string {
  const withoutAccents = outputName.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const wordsJoinedByHyphens = withoutAccents.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const withoutHyphensAtTheEnds = wordsJoinedByHyphens.replace(/^-+|-+$/g, '');
  return withoutHyphensAtTheEnds.slice(0, longestOutputIdLength).replace(/-+$/, '');
}

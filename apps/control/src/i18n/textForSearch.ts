/**
 * Text as a search on the page compares it, the same everywhere the operator types to find
 * something (Cadastros' picker, the history of "Eventos"): lower case, accents taken off
 * ("Biguá" finds "bigua"), spaces at the ends dropped. An operator types fast and without
 * accents.
 */
export function writeTextForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

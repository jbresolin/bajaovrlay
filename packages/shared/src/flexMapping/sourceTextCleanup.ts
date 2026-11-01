/**
 * How every text value a flex mapping writes is cleaned up (BAJAOVRLAY-53). Sources send
 * names as typed: the Baja app's results API keeps trailing spaces ("Procobaja ") and HTML
 * entities ("&nbsp;") on purpose. Decoding first and collapsing spaces after means an
 * "&nbsp;" at the end is trimmed like any other space.
 */

/**
 * The named entities organisers type: the HTML basics and the accented letters of
 * Portuguese. Anything else is kept as written, since guessing would be worse.
 */
const characterOfNamedEntity: Readonly<Record<string, string>> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  aacute: 'á',
  Aacute: 'Á',
  agrave: 'à',
  Agrave: 'À',
  acirc: 'â',
  Acirc: 'Â',
  atilde: 'ã',
  Atilde: 'Ã',
  eacute: 'é',
  Eacute: 'É',
  ecirc: 'ê',
  Ecirc: 'Ê',
  iacute: 'í',
  Iacute: 'Í',
  oacute: 'ó',
  Oacute: 'Ó',
  ocirc: 'ô',
  Ocirc: 'Ô',
  otilde: 'õ',
  Otilde: 'Õ',
  uacute: 'ú',
  Uacute: 'Ú',
  uuml: 'ü',
  Uuml: 'Ü',
  ccedil: 'ç',
  Ccedil: 'Ç',
  ordm: 'º',
  ordf: 'ª',
  deg: '°',
};

// "&name;", "&#39;" or "&#x27;".
const entityPattern = /&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);/g;

// Any run of white space, the non-breaking space (U+00A0) included.
const whiteSpaceRunPattern = /\s+/g;

/** Decodes one entity's name ("nbsp", "#39", "#x27"), or gives it back as written. */
function decodeOneEntity(wholeEntity: string, entityName: string): string {
  if (entityName.startsWith('#x')) {
    return characterOfCodePoint(Number.parseInt(entityName.slice(2), 16), wholeEntity);
  }
  if (entityName.startsWith('#')) {
    return characterOfCodePoint(Number.parseInt(entityName.slice(1), 10), wholeEntity);
  }
  return characterOfNamedEntity[entityName] ?? wholeEntity;
}

/** The character of a code point, or the entity as written when there is no such one. */
function characterOfCodePoint(codePoint: number, wholeEntity: string): string {
  const isACodePoint = Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff;
  return isACodePoint ? String.fromCodePoint(codePoint) : wholeEntity;
}

/**
 * Cleans up one text from a source: HTML entities decoded, every run of spaces, tabs and
 * line breaks (a non-breaking space too) made one space, and the ends trimmed.
 */
export function cleanUpTextFromASource(text: string): string {
  const decodedText = text.replace(entityPattern, decodeOneEntity);
  return decodedText.replace(whiteSpaceRunPattern, ' ').trim();
}

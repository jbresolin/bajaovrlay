import { ptBRFlexMapping } from './ptBRFlexMapping.js';

/** One step of a path: a key of an object, or an index of a list (from 0). */
export type ValuePathSegment = { kind: 'key'; key: string } | { kind: 'index'; index: number };

/** The answer of parseValuePath: the steps of the path, or a pt-BR sentence saying why not. */
export type ValuePathParsing =
  { ok: true; segments: ValuePathSegment[] } | { ok: false; reason: string };

/**
 * What readValueAtPath found: a value (null included: the source sent it), nothing (a key
 * or an index the response does not have), or a path that could not be read at all.
 */
export type ValueAtPath =
  | { outcome: 'found'; value: unknown }
  | { outcome: 'nothingThere' }
  | { outcome: 'pathRefused'; reason: string };

/** Builds the refusal of a path, with its pt-BR reason. */
function refusePath(reason: string): ValuePathParsing {
  return { ok: false, reason };
}

/**
 * Parses a path such as `dados.corrida.carros[3].equipe` into its steps. Written by hand
 * in steps, on purpose: a path is dot-separated parts, and each part is a key followed by
 * zero or more `[n]` indices. Nothing else exists: no wildcards, filters, recursion or
 * functions, and a key cannot hold a dot or a bracket. Every refusal quotes the path.
 */
export function parseValuePath(path: string): ValuePathParsing {
  if (path === '') {
    return refusePath(ptBRFlexMapping.pathReasons.emptyPath);
  }

  const segments: ValuePathSegment[] = [];
  const dotSeparatedParts = path.split('.');
  for (const part of dotSeparatedParts) {
    const partParsing = parseDotSeparatedPart(part, path);
    if (!partParsing.ok) {
      return partParsing;
    }
    segments.push(...partParsing.segments);
  }
  return { ok: true, segments };
}

/**
 * Parses one part between dots: `carros[3]` gives the key "carros" then the index 3.
 * `wholePath` is only for the reason, which quotes the path the operator wrote.
 */
function parseDotSeparatedPart(part: string, wholePath: string): ValuePathParsing {
  const reasons = ptBRFlexMapping.pathReasons;
  if (part === '') {
    return refusePath(reasons.emptySegment(wholePath));
  }

  const firstOpeningBracketAt = part.indexOf('[');
  const hasIndices = firstOpeningBracketAt !== -1;
  const key = hasIndices ? part.slice(0, firstOpeningBracketAt) : part;
  if (key === '') {
    // "[0].equipe" or "a.[0]": a response whose top level is a list is out of scope.
    return refusePath(reasons.indexWithoutKey(wholePath));
  }
  if (key.includes(']')) {
    return refusePath(reasons.strayClosingBracket(wholePath));
  }

  const segments: ValuePathSegment[] = [{ kind: 'key', key }];
  // What is left after the key: "[3]", "[1][0]", or nothing. Each turn of the loop reads
  // one "[n]" off its front.
  let textAfterKey = hasIndices ? part.slice(firstOpeningBracketAt) : '';
  while (textAfterKey !== '') {
    if (!textAfterKey.startsWith('[')) {
      return refusePath(reasons.textAfterIndex(wholePath));
    }
    const closingBracketAt = textAfterKey.indexOf(']');
    if (closingBracketAt === -1) {
      return refusePath(reasons.unclosedBracket(wholePath));
    }

    const indexText = textAfterKey.slice(1, closingBracketAt);
    const indexParsing = parseIndexText(indexText, wholePath);
    if (!indexParsing.ok) {
      return indexParsing;
    }
    segments.push(...indexParsing.segments);
    textAfterKey = textAfterKey.slice(closingBracketAt + 1);
  }
  return { ok: true, segments };
}

/** Parses the text between two brackets: digits only, so "3" and never "-1", "*" or "". */
function parseIndexText(indexText: string, wholePath: string): ValuePathParsing {
  const reasons = ptBRFlexMapping.pathReasons;
  if (indexText === '') {
    return refusePath(reasons.emptyIndex(wholePath));
  }
  if (indexText.startsWith('-')) {
    return refusePath(reasons.negativeIndex(wholePath));
  }
  const isDigitsOnly = /^[0-9]+$/.test(indexText);
  if (!isDigitsOnly) {
    return refusePath(reasons.indexNotWholeNumber(wholePath));
  }
  const index = Number(indexText);
  if (!Number.isSafeInteger(index)) {
    return refusePath(reasons.indexTooLarge(wholePath));
  }
  return { ok: true, segments: [{ kind: 'index', index }] };
}

/** True for a JSON object: not null and not a list, which both have typeof "object". */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads the value at `path` in a parsed JSON response. A key is read from an object only
 * (never from a list, so "carros.length" finds nothing) and an index from a list only. A
 * missing key, an index past the end, or a step below a text or a null finds nothing
 * there, which the mapping reads as "the source does not know".
 */
export function readValueAtPath(json: unknown, path: string): ValueAtPath {
  const parsing = parseValuePath(path);
  if (!parsing.ok) {
    return { outcome: 'pathRefused', reason: parsing.reason };
  }

  let currentValue: unknown = json;
  for (const segment of parsing.segments) {
    const nextValue = readOneStep(currentValue, segment);
    if (nextValue.outcome !== 'found') {
      return nextValue;
    }
    currentValue = nextValue.value;
  }
  return { outcome: 'found', value: currentValue };
}

/** Takes one step of a path from `value`: its key, or its element at an index. */
function readOneStep(value: unknown, segment: ValuePathSegment): ValueAtPath {
  if (segment.kind === 'key') {
    // Object.hasOwn, not `in`: "constructor" must not find the object's inherited members.
    if (isPlainObject(value) && Object.hasOwn(value, segment.key)) {
      return { outcome: 'found', value: value[segment.key] };
    }
    return { outcome: 'nothingThere' };
  }

  if (Array.isArray(value) && segment.index < value.length) {
    return { outcome: 'found', value: value[segment.index] as unknown };
  }
  return { outcome: 'nothingThere' };
}

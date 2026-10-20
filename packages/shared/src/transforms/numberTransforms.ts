import { ptBRTransforms } from './ptBRTransforms.js';
import { quoteValueForReason } from './quoteValueForReason.js';
import {
  giveTransformedValue,
  type MappingTransform,
  refuseTransformValue,
  type TransformResult,
} from './transform.js';

/**
 * A number written as text: an optional minus, digits, and at most one decimal separator
 * (comma or point) followed by digits. "12,5", "12.5", "-3", "0,25".
 * A thousands separator is not accepted at all, so "1.234,5" fails here and is refused
 * as ambiguous instead of guessed. What could go wrong: "1.234" passes and reads as
 * one point two three four, not one thousand two hundred; timing systems send decimals,
 * not thousands, so that is the reading taken.
 */
const numberTextPattern = /^-?\d+([.,]\d+)?$/;

/** A whole number written as text: an optional minus and digits only. "42", "-3". */
const integerTextPattern = /^-?\d+$/;

/** Answers whether the text holds digits and more than one separator, like "1.234,5". */
function isAmbiguousNumberText(text: string): boolean {
  const hasDigits = /\d/.test(text);
  const separatorCount = text
    .split('')
    .filter((character) => character === '.' || character === ',').length;
  return hasDigits && separatorCount > 1;
}

/**
 * Reads a decimal number written as text; the pt-BR comma and the point both mark the
 * decimals. Spaces at the ends are ignored. Text only: a number from the source needs no
 * transform, and accepting both here would hide a source that changed its format.
 */
function readTextAsNumber(value: unknown): TransformResult {
  const quotedValue = quoteValueForReason(value);
  if (typeof value !== 'string') {
    return refuseTransformValue(ptBRTransforms.reasons.notText(quotedValue));
  }

  const trimmedText = value.trim();
  if (isAmbiguousNumberText(trimmedText)) {
    return refuseTransformValue(ptBRTransforms.reasons.ambiguousNumberText(quotedValue));
  }
  if (!numberTextPattern.test(trimmedText)) {
    return refuseTransformValue(ptBRTransforms.reasons.notANumber(quotedValue));
  }

  // The pattern allows one separator at most, so turning a comma into a point gives text
  // that Number reads exactly as the source meant it.
  const textWithDecimalPoint = trimmedText.replace(',', '.');
  return giveTransformedValue(Number(textWithDecimalPoint));
}

/**
 * Reads a whole number written as text, such as a lap count "42". A decimal ("42,5") is
 * refused rather than rounded, because a lap count with decimals means the wrong field
 * was mapped.
 */
function readTextAsInteger(value: unknown): TransformResult {
  const quotedValue = quoteValueForReason(value);
  if (typeof value !== 'string') {
    return refuseTransformValue(ptBRTransforms.reasons.notText(quotedValue));
  }

  const trimmedText = value.trim();
  if (!integerTextPattern.test(trimmedText)) {
    return refuseTransformValue(ptBRTransforms.reasons.notAnInteger(quotedValue));
  }

  const integer = Number(trimmedText);
  // Past 2^53 a number in JavaScript silently loses its last digits.
  if (!Number.isSafeInteger(integer)) {
    return refuseTransformValue(ptBRTransforms.reasons.integerTooLarge(quotedValue));
  }
  return giveTransformedValue(integer);
}

/** "12,5" and "12.5" become 12.5; "1.234,5" is refused as ambiguous. */
export const textToNumberTransform: MappingTransform = {
  id: 'textToNumber',
  family: 'mapping',
  label: ptBRTransforms.transforms.textToNumber.label,
  description: ptBRTransforms.transforms.textToNumber.description,
  apply: (value) => readTextAsNumber(value),
};

/** "42" becomes 42; "42,5" is refused. */
export const textToIntegerTransform: MappingTransform = {
  id: 'textToInteger',
  family: 'mapping',
  label: ptBRTransforms.transforms.textToInteger.label,
  description: ptBRTransforms.transforms.textToInteger.description,
  apply: (value) => readTextAsInteger(value),
};

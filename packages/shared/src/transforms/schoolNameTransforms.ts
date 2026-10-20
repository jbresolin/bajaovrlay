import { z } from 'zod';

import { ptBRTransforms } from './ptBRTransforms.js';
import { quoteValueForReason } from './quoteValueForReason.js';
import {
  type BindingTransform,
  giveTransformedValue,
  refuseTransformValue,
  type TransformResult,
} from './transform.js';

/**
 * The parameters of shortenSchoolName: the most letters the graphic has room for, from 4
 * (three letters and "…") to 60.
 */
export const ShortenSchoolNameParametersSchema = z.object(
  {
    maxLength: z
      .number({ error: ptBRTransforms.parameterReasons.maxLengthOutOfRange })
      .int({ error: ptBRTransforms.parameterReasons.maxLengthOutOfRange })
      .min(4, { error: ptBRTransforms.parameterReasons.maxLengthOutOfRange })
      .max(60, { error: ptBRTransforms.parameterReasons.maxLengthOutOfRange }),
  },
  { error: ptBRTransforms.parameterReasons.maxLengthOutOfRange },
);

/**
 * Cuts a name longer than maxLength so it fits, "…" included: at the last whole word that
 * fits, or inside the first word when not even that fits. A name that fits is kept as it
 * is. It never guesses an abbreviation ("Universidade Federal do Paraná" never becomes
 * "UFPR"): a wrong guess on air is worse than a cut name, and the short form belongs in
 * the source (the shapes' schoolName is already the short form).
 * What could go wrong: the count is in UTF-16 units, so a letter with an accent written
 * as two code points counts twice; school names arrive composed, as text normally does.
 */
function shortenNameToFit(value: unknown, parameters: unknown): TransformResult {
  if (typeof value !== 'string') {
    return refuseTransformValue(ptBRTransforms.reasons.notText(quoteValueForReason(value)));
  }
  // The item save already checked maxLength; this is the last guard, apply never throws.
  const parsedParameters = ShortenSchoolNameParametersSchema.safeParse(parameters);
  if (!parsedParameters.success) {
    return refuseTransformValue(ptBRTransforms.parameterReasons.maxLengthOutOfRange);
  }
  const maxLength = parsedParameters.data.maxLength;
  const name = value.trim();
  if (name.length <= maxLength) {
    return giveTransformedValue(name);
  }

  // Room for the letters, one place kept for the "…".
  const cutMark = ptBRTransforms.onAirTexts.cutMark;
  const lettersThatFit = name.slice(0, maxLength - cutMark.length);
  const doesTheCutFallBetweenWords = name.charAt(lettersThatFit.length) === ' ';
  const lastSpaceInside = lettersThatFit.lastIndexOf(' ');
  const keptPart =
    doesTheCutFallBetweenWords || lastSpaceInside <= 0
      ? lettersThatFit
      : lettersThatFit.slice(0, lastSpaceInside);
  return giveTransformedValue(`${keptPart.trimEnd()}${cutMark}`);
}

/** "Universidade Federal do Paraná" in 20 letters becomes "Universidade…". */
export const shortenSchoolNameTransform: BindingTransform = {
  id: 'shortenSchoolName',
  family: 'binding',
  label: ptBRTransforms.transforms.shortenSchoolName.label,
  description: ptBRTransforms.transforms.shortenSchoolName.description,
  parametersSchema: ShortenSchoolNameParametersSchema,
  valueTypesRead: ['text'],
  valueTypeGiven: 'text',
  apply: (value, parameters) => shortenNameToFit(value, parameters),
};

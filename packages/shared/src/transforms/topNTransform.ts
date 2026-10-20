import { z } from 'zod';

import { ptBRTransforms } from './ptBRTransforms.js';
import { quoteValueForReason } from './quoteValueForReason.js';
import {
  type BindingTransform,
  giveTransformedValue,
  type JsonValue,
  refuseTransformValue,
  type TransformResult,
} from './transform.js';

/**
 * The parameters of topN: how many entries to keep, a whole number from 1 to 60. Sixty
 * covers the largest Baja field; a tower showing every car takes the whole list instead.
 */
export const TopNParametersSchema = z.object(
  {
    n: z
      .number({ error: ptBRTransforms.parameterReasons.topNOutOfRange })
      .int({ error: ptBRTransforms.parameterReasons.topNOutOfRange })
      .min(1, { error: ptBRTransforms.parameterReasons.topNOutOfRange })
      .max(60, { error: ptBRTransforms.parameterReasons.topNOutOfRange }),
  },
  { error: ptBRTransforms.parameterReasons.topNOutOfRange },
);

/**
 * Keeps the first n entries of a list, in their order; a list shorter than n is kept
 * whole, and nothing is invented to fill it. Anything but a list is refused.
 */
function keepFirstEntriesOfList(value: unknown, parameters: unknown): TransformResult {
  if (!Array.isArray(value)) {
    return refuseTransformValue(ptBRTransforms.reasons.notAList(quoteValueForReason(value)));
  }
  // The item save already checked n; this is the last guard, because apply never throws.
  const parsedParameters = TopNParametersSchema.safeParse(parameters);
  if (!parsedParameters.success) {
    return refuseTransformValue(ptBRTransforms.parameterReasons.topNOutOfRange);
  }
  const firstEntries = value.slice(0, parsedParameters.data.n) as JsonValue[];
  return giveTransformedValue(firstEntries);
}

/** The first six cars of the positions, for a tower that shows six. */
export const topNTransform: BindingTransform = {
  id: 'topN',
  family: 'binding',
  label: ptBRTransforms.transforms.topN.label,
  description: ptBRTransforms.transforms.topN.description,
  parametersSchema: TopNParametersSchema,
  valueTypesRead: ['positionsEntries', 'standingsEntries'],
  valueTypeGiven: 'sameAsTheValueRead',
  apply: (value, parameters) => keepFirstEntriesOfList(value, parameters),
};

import { ptBRTransforms } from './ptBRTransforms.js';
import { quoteValueForReason } from './quoteValueForReason.js';
import {
  giveTransformedValue,
  refuseTransformValue,
  type Transform,
  type TransformResult,
} from './transform.js';

/**
 * Removes the spaces, tabs and line breaks at either end of a text, keeping those inside:
 * "  Baja UFPR " becomes "Baja UFPR". A text that is only spaces becomes "", which the
 * canonical validation then refuses for a required name.
 */
function trimSpacesAtTheEnds(value: unknown): TransformResult {
  if (typeof value !== 'string') {
    return refuseTransformValue(ptBRTransforms.reasons.notText(quoteValueForReason(value)));
  }
  return giveTransformedValue(value.trim());
}

/** "  Baja UFPR " becomes "Baja UFPR". */
export const trimTextTransform: Transform = {
  id: 'trimText',
  label: ptBRTransforms.transforms.trimText.label,
  description: ptBRTransforms.transforms.trimText.description,
  apply: (value) => trimSpacesAtTheEnds(value),
};

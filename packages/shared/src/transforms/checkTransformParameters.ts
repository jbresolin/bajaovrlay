import { ptBRTransforms } from './ptBRTransforms.js';
import type { TransformFamily } from './transform.js';
import { findTransform } from './transformRegistry.js';

/** The answer of checkTransformParameters: fine, or one pt-BR sentence saying why not. */
export type TransformParametersCheck = { ok: true } | { ok: false; reason: string };

/**
 * Checks, when a config or an item is saved and not on air, that a transform id exists in
 * the registry, belongs to the family of what is being saved (`mapping` for a flex
 * source's rule, `binding` for an item field), and that its parameters are right: none for
 * a transform that takes none, and passing its schema for one that does. So a wrong table
 * or a top of 0 is refused when the operator saves, not in the middle of a race.
 */
export function checkTransformParameters(
  transformId: string,
  parameters: unknown,
  familyOfWhatIsSaved: TransformFamily,
): TransformParametersCheck {
  const transform = findTransform(transformId);
  if (transform === undefined) {
    return { ok: false, reason: ptBRTransforms.parameterReasons.unknownTransform(transformId) };
  }
  if (transform.family !== familyOfWhatIsSaved) {
    const reasons = ptBRTransforms.parameterReasons;
    const reason =
      transform.family === 'binding'
        ? reasons.bindingTransformInMapping(transform.label)
        : reasons.mappingTransformInBinding(transform.label);
    return { ok: false, reason };
  }

  if (transform.parametersSchema === undefined) {
    // Parameters on a transform that reads none would be ignored, and an operator who
    // wrote them believes they do something.
    if (parameters !== undefined) {
      return {
        ok: false,
        reason: ptBRTransforms.parameterReasons.takesNoParameters(transform.label),
      };
    }
    return { ok: true };
  }

  // A schema's own messages are pt-BR from the catalog; anything Zod finds deeper
  // (a value JSON cannot hold) falls back to the general sentence instead of Zod's English.
  const generalReason = ptBRTransforms.parameterReasons.invalidParameters(transform.label);
  const parsedParameters = transform.parametersSchema.safeParse(parameters, {
    error: () => generalReason,
  });
  if (!parsedParameters.success) {
    const firstIssueMessage = parsedParameters.error.issues[0]?.message ?? generalReason;
    return { ok: false, reason: firstIssueMessage };
  }
  return { ok: true };
}

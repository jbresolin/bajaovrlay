import { ptBRTransforms } from './ptBRTransforms.js';
import { findTransform } from './transformRegistry.js';

/** The answer of checkTransformParameters: fine, or one pt-BR sentence saying why not. */
export type TransformParametersCheck = { ok: true } | { ok: false; reason: string };

/**
 * Checks, when a config is validated and not at poll time, that a transform id exists in
 * the registry and that its parameters are right: none for a transform that takes none,
 * and passing its schema for one that does. The source's config schema calls this, so a
 * wrong table is refused when the operator saves, not in the middle of a race.
 */
export function checkTransformParameters(
  transformId: string,
  parameters: unknown,
): TransformParametersCheck {
  const transform = findTransform(transformId);
  if (transform === undefined) {
    return { ok: false, reason: ptBRTransforms.parameterReasons.unknownTransform(transformId) };
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

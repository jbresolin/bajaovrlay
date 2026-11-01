/**
 * Refusing a whole answer by a flag (BAJAOVRLAY-53): a mapping's `refuseWhen` names a path
 * on its response, a value and the operator's pt-BR message. When the value there equals
 * it (strictly: the text "true" is not true), the poll fails with that message alone, and
 * the last good snapshot stays on air (rule 4). Checked before any shape is built, so the
 * operator reads the sentence, not a list of shape problems the hidden answer would cause.
 */
import type { FlexMappingConfig } from './flexMappingConfig.js';
import { readValueAtPath } from './valuePath.js';

/** The messages of every mapping whose flag is raised in its response, in config order. */
export function findRefusalsByFlag(
  mappings: FlexMappingConfig,
  responsesByRequestId: Readonly<Record<string, unknown>>,
): string[] {
  const refusalMessages: string[] = [];
  for (const mapping of mappings) {
    const refuseWhen = mapping.refuseWhen;
    if (refuseWhen === undefined || !Object.hasOwn(responsesByRequestId, mapping.requestId)) {
      continue;
    }
    const flagReading = readValueAtPath(responsesByRequestId[mapping.requestId], refuseWhen.path);
    const isFlagRaised = flagReading.outcome === 'found' && flagReading.value === refuseWhen.equals;
    if (isFlagRaised && !refusalMessages.includes(refuseWhen.message)) {
      refusalMessages.push(refuseWhen.message);
    }
  }
  return refusalMessages;
}

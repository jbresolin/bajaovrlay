/**
 * Refusing a whole answer by a flag (BAJAOVRLAY-53): a mapping's `refuseWhen` names a path
 * on its response, a comparison and the operator's pt-BR message. The answer is refused
 * when the value there equals `equals` (strictly: the text "true" is not true), or when it
 * is found and is none of `notOneOf` (gate 2 of PR #38: a word the preset does not know).
 * The poll fails with that message alone, `{valor}` in it replaced by the value read, and
 * the last good snapshot stays on air (rule 4). Checked before any shape is built, so the
 * operator reads the sentence, not a list of shape problems the answer would cause.
 *
 * A value not found is never refused by `notOneOf`: there is nothing to name, and the
 * mapping's own rules and the shape's checks already fail an answer missing what it needs.
 */
import type { FlexMappingConfig } from './flexMappingConfig.js';
import type { FlexRefusalFlag } from './flexMappingListOptions.js';
import { readValueAtPath } from './valuePath.js';

// Where the value read goes in the operator's message.
const valuePlaceholder = '{valor}';

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
    if (flagReading.outcome !== 'found') {
      continue;
    }
    if (!isAnswerRefused(refuseWhen, flagReading.value)) {
      continue;
    }
    const message = writeRefusalMessage(refuseWhen.message, flagReading.value);
    if (!refusalMessages.includes(message)) {
      refusalMessages.push(message);
    }
  }
  return refusalMessages;
}

/** Says whether the value read refuses the answer, by the refusal's one comparison. */
function isAnswerRefused(refuseWhen: FlexRefusalFlag, valueRead: unknown): boolean {
  if (refuseWhen.notOneOf !== undefined) {
    const isAKnownValue = refuseWhen.notOneOf.some((knownValue) => knownValue === valueRead);
    return !isAKnownValue;
  }
  return valueRead === refuseWhen.equals;
}

/** The operator's message with the value read in place of `{valor}`: text as it is, else JSON. */
function writeRefusalMessage(message: string, valueRead: unknown): string {
  const valueText = typeof valueRead === 'string' ? valueRead : JSON.stringify(valueRead);
  return message.replaceAll(valuePlaceholder, valueText);
}

/**
 * The line under a field set to "Fonte": what the field would get if the item were taken
 * now, or why it would get nothing, in the operator's words. Pure: the panel hands it the
 * shared resolution of the binding against the slices the page holds.
 */
import type { BindingFieldValue, BindingResolution } from '@bajaovrlay/shared';

import {
  findSourceValueKindOfBinding,
  writeSourceValueForReading,
} from '@/features/bindings/sourceValueText';
import { ptBR } from '@/i18n/ptBR';

const editorTexts = ptBR.bindings.editor;

/**
 * Writes the value of now as every value read from a source is written
 * (sourceValueText.ts: the flag in words, yes/no, the clock time as mm:ss, the moment as
 * a time of day), followed by "(corrigido)" when an override changed it. An absent value
 * and a binding that cannot be read say so with the shared pt-BR reason.
 */
export function describeBindingValueNow(
  resolution: BindingResolution,
  binding: BindingFieldValue,
): string {
  if (resolution.status === 'valueAbsent') {
    return editorTexts.valueAbsentNow(resolution.problem);
  }
  if (resolution.status === 'unresolvable') {
    return editorTexts.cannotReadNow(resolution.problem);
  }
  const valueText = writeSourceValueForReading(
    resolution.value,
    findSourceValueKindOfBinding(binding),
  );
  const withCorrection = resolution.isOverridden
    ? `${valueText} ${editorTexts.correctedMark}`
    : valueText;
  return editorTexts.valueNowLabel(withCorrection);
}

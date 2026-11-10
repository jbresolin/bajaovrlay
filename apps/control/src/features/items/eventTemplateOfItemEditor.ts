/**
 * What the item editor says about an event template (BAJAOVRLAY-67): which rules use it,
 * the banner worded per kind, and whose sample event fills its examples. Pure, from the
 * rules the server holds.
 */
import type { EventRule, InboxEventKind } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

const editorTexts = ptBR.events.editor;

/** The kinds whose rule shows its events with this item, in the order of the rules. */
export function listKindsOfRulesUsingItem(
  eventRules: EventRule[],
  itemId: string | undefined,
): InboxEventKind[] {
  if (itemId === undefined) {
    return [];
  }
  return eventRules.filter((rule) => rule.itemId === itemId).map((rule) => rule.kind);
}

/**
 * The kind whose sample event the editor's examples read: the first rule using the item,
 * or an incident when none does, as a template's "Prévia" chooses (eventFillOfPreview.ts).
 */
export function chooseSampleEventKindOfTemplate(kindsUsingIt: InboxEventKind[]): InboxEventKind {
  return kindsUsingIt[0] ?? 'newIncident';
}

/**
 * The banner of a template: "Modelo de evento: preenchido a cada nova volta mais rápida,
 * vinda da fonte.", every kind that uses it joined; or that no rule uses it yet.
 */
export function describeTemplateBanner(kindsUsingIt: InboxEventKind[]): string {
  if (kindsUsingIt.length === 0) {
    return editorTexts.templateUsedByNoRule;
  }
  return editorTexts.templateFilledBy(
    kindsUsingIt.map((kind) => editorTexts.whatFillsATemplateOfKind[kind]),
  );
}

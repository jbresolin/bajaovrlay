/**
 * The templates of "Regras" (BAJAOVRLAY-67), as pure choices: the templates a kind's
 * events fill ("Trocar"), the graphics a new template of the kind can be made on, and
 * what "+ Novo modelo" opens the item editor with. The rules themselves are shared with
 * the server (packages/shared/src/eventInbox/eventTemplateKinds.ts).
 */
import {
  buildEventFieldsOfANewTemplate,
  doesTemplateSuitKind,
  type Graphic,
  type InboxEventKind,
  type Item,
} from '@bajaovrlay/shared';

import type { ItemEditorPrefill } from '@/features/items/ItemEditorTargetProvider';

/** The templates the kind's events fill, in the server's order: what "Trocar" offers. */
export function listTemplatesSuitingKind(items: Item[], kind: InboxEventKind): Item[] {
  return items.filter((item) => doesTemplateSuitKind(item.fields, kind));
}

/**
 * The graphics a new template of the kind can be made on: those with at least one field
 * named like a payload field the kind carries, of a type that fits. Any other would make
 * an item no event fills, which the server refuses among the templates.
 */
export function listGraphicsForANewTemplate(graphics: Graphic[], kind: InboxEventKind): Graphic[] {
  return graphics.filter(
    (graphic) =>
      Object.keys(buildEventFieldsOfANewTemplate(graphic.manifest.schema, kind)).length > 0,
  );
}

/**
 * What "+ Novo modelo" opens the item editor with: the graphic, its default layer, and
 * each field named like one of the kind's payload fields already read from the event.
 */
export function buildPrefillOfANewTemplate(
  graphic: Graphic,
  kind: InboxEventKind,
): ItemEditorPrefill {
  return {
    graphicId: graphic.id,
    layerId: graphic.defaultLayerId,
    fields: buildEventFieldsOfANewTemplate(graphic.manifest.schema, kind),
  };
}

import type { EventRule, Item, QuickFirePanel } from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';

/**
 * The panel the notice items lived in until BAJAOVRLAY-67, "Avisos"; a fixed, readable id
 * like "atalhos". No new database gets it: the templates now live in "Modelos de evento"
 * (moveEventTemplatesOffQuickFire.ts takes them off an older database's panels, once).
 */
export const eventsQuickFirePanelId = 'avisos';

/** The home of every seeded template (BAJAOVRLAY-67). */
const eventTemplatesHome: Item['home'] = { kind: 'eventTemplates' };

/** The item the default rule shows a new fastest lap with. */
export const fastestLapItemId = 'volta-mais-rapida';

/** The item the default rules show a penalty, an incident or a manual event with. */
export const penaltyItemId = 'penalidade';

/** The item the default rule shows an approved Super Chat with (BAJAOVRLAY-35). */
export const superChatItemId = 'super-chat';

/**
 * The "Super Chat" item: the super-chat graphic on the notice layer, its three fields read
 * from the Super Chat's event (the amount, the viewer, the message). Coloured "warning",
 * which the brief does not fix: a viewer's text is the one item that needs a person's care.
 */
const seededSuperChatItem: Item = {
  id: superChatItemId,
  home: eventTemplatesHome,
  order: 2,
  graphicId: 'super-chat',
  layerId: 'notice',
  label: ptBR.eventErrors.seededItemLabels.superChat,
  color: 'warning',
  notes: '',
  fields: {
    amountText: { kind: 'eventField', path: 'amountText' },
    authorName: { kind: 'eventField', path: 'authorName' },
    messageText: { kind: 'eventField', path: 'messageText' },
  },
};

/**
 * The three templates: the two of BAJAOVRLAY-44 on the notice graphic and the notice layer,
 * in "Modelos de evento". Every field the event fills is an event field, so they are
 * templates: they go on air only through an event, and Prévia shows them filled from a
 * sample. "Penalidade" also shows a general notice, about no car (BAJAOVRLAY-67): the
 * notice graphic's car is optional, so a payload with none leaves its row out.
 * The fastest-lap variant reads the lap and its time; the penalty variant the kind of
 * notice, the reason and the penalty. Both read the car, its team and its school. Then the
 * "Super Chat" (BAJAOVRLAY-35), seededSuperChatItem above.
 */
const seededEventItems: Item[] = [
  {
    id: fastestLapItemId,
    home: eventTemplatesHome,
    order: 0,
    graphicId: 'notice',
    layerId: 'notice',
    label: ptBR.eventErrors.seededItemLabels.fastestLap,
    color: 'success',
    notes: '',
    fields: {
      variant: { kind: 'literal', value: 'fastestLap' },
      carNumber: { kind: 'eventField', path: 'carNumber' },
      teamName: { kind: 'eventField', path: 'teamName' },
      schoolName: { kind: 'eventField', path: 'schoolName' },
      lapNumber: { kind: 'eventField', path: 'lapNumber' },
      lapTimeText: { kind: 'eventField', path: 'lapTimeText' },
    },
  },
  {
    id: penaltyItemId,
    home: eventTemplatesHome,
    order: 1,
    graphicId: 'notice',
    layerId: 'notice',
    label: ptBR.eventErrors.seededItemLabels.penalty,
    color: 'danger',
    notes: '',
    fields: {
      variant: { kind: 'literal', value: 'penalty' },
      noticeKind: { kind: 'eventField', path: 'noticeKind' },
      carNumber: { kind: 'eventField', path: 'carNumber' },
      teamName: { kind: 'eventField', path: 'teamName' },
      schoolName: { kind: 'eventField', path: 'schoolName' },
      reason: { kind: 'eventField', path: 'reason' },
      penaltyText: { kind: 'eventField', path: 'penaltyText' },
    },
  },
  seededSuperChatItem,
];

/**
 * The items with the three templates added to "Modelos de evento" (after any template
 * already there), each one only when no item of its id exists. Called once per database,
 * when the event rules are seeded (loadEventInboxSlices.ts), so a template the operator
 * deleted later is never brought back.
 */
export function addSeededEventTemplates(items: Item[]): Item[] {
  const templatesAlreadyThere = items.filter((item) => item.home.kind === 'eventTemplates');
  const itemsMissing = seededEventItems.filter(
    (seededItem) => !items.some((item) => item.id === seededItem.id),
  );
  const itemsAdded = itemsMissing.map((seededItem, index) => ({
    ...seededItem,
    order: templatesAlreadyThere.length + index,
  }));
  return [...items, ...itemsAdded];
}

/**
 * The items and rules of a database seeded before BAJAOVRLAY-35, with the "Super Chat" item
 * added to "Avisos" (after its last item), where its two templates still were, and the
 * Super Chat rule naming it, or undefined when nothing is to change. The move of the
 * templates off the panels, at the same boot, then takes it to "Modelos de evento". Added only when the rule still has no item and no item of its
 * id exists: a rule whose operator chose another item keeps it. Not added either when the
 * operator deleted "Avisos": a deleted panel is never brought back for it. Called once per
 * database: the boot records it in `seeds_done` as superChatItem (loadEventInboxSlices.ts),
 * so an operator who later deletes the item and clears the rule never gets it back.
 */
export function addSeededSuperChatItemToAnOlderDatabase(
  eventRules: EventRule[],
  quickFirePanels: QuickFirePanel[],
  items: Item[],
): { eventRules: EventRule[]; items: Item[] } | undefined {
  const superChatRule = eventRules.find((rule) => rule.kind === 'superChat');
  const doesTheRuleHaveAnItem = superChatRule === undefined || superChatRule.itemId !== null;
  const isTheItemThere = items.some((item) => item.id === superChatItemId);
  const isThePanelThere = quickFirePanels.some((panel) => panel.id === eventsQuickFirePanelId);
  if (doesTheRuleHaveAnItem || isTheItemThere || !isThePanelThere) {
    return undefined;
  }
  const ordersInThePanel = items
    .filter(
      (item) => item.home.kind === 'quickFire' && item.home.panelId === eventsQuickFirePanelId,
    )
    .map((item) => item.order);
  const itemAdded: Item = {
    ...seededSuperChatItem,
    home: { kind: 'quickFire', panelId: eventsQuickFirePanelId },
    order: Math.max(-1, ...ordersInThePanel) + 1,
  };
  const rulesAfter = eventRules.map((rule) =>
    rule.kind === 'superChat' ? { ...rule, itemId: superChatItemId } : rule,
  );
  return { eventRules: rulesAfter, items: [...items, itemAdded] };
}

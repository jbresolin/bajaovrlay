import type { EventRule, Item, QuickFirePanel } from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';

/**
 * The panel the two notice items live in, "Avisos"; a fixed, readable id like "atalhos".
 * Not "Eventos", as the brief named it: the strip's inbox tab is "Eventos", and two tabs
 * of one name would be told apart by nobody (decisions, BAJAOVRLAY-44).
 */
export const eventsQuickFirePanelId = 'avisos';

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
  home: { kind: 'quickFire', panelId: eventsQuickFirePanelId },
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
 * The three notice items: the two of BAJAOVRLAY-44 on the notice graphic and the notice layer, in the
 * "Avisos" panel. Every field the event fills is an event field, so they are templates:
 * they go on air only through an event, and Prévia shows them filled from a sample.
 * The fastest-lap variant reads the lap and its time; the penalty variant the kind of
 * notice, the reason and the penalty. Both read the car, its team and its school. Then the
 * "Super Chat" (BAJAOVRLAY-35), seededSuperChatItem above.
 */
const seededEventItems: Item[] = [
  {
    id: fastestLapItemId,
    home: { kind: 'quickFire', panelId: eventsQuickFirePanelId },
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
    home: { kind: 'quickFire', panelId: eventsQuickFirePanelId },
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
 * The panels and items with the "Avisos" panel (after the last panel) and its three items
 * (after every other item) added, each one only when no panel or item of its id exists.
 * Called once per database, when the event rules are seeded (loadEventInboxSlices.ts),
 * so a panel the operator deleted later is never brought back.
 */
export function addSeededEventPanelAndItems(
  quickFirePanels: QuickFirePanel[],
  items: Item[],
): { quickFirePanels: QuickFirePanel[]; items: Item[] } {
  const isPanelThere = quickFirePanels.some((panel) => panel.id === eventsQuickFirePanelId);
  const lastPanelOrder = Math.max(-1, ...quickFirePanels.map((panel) => panel.order));
  const panelsAfter = isPanelThere
    ? quickFirePanels
    : [
        ...quickFirePanels,
        {
          id: eventsQuickFirePanelId,
          name: ptBR.eventErrors.seededPanelName,
          order: lastPanelOrder + 1,
        },
      ];
  const itemsMissing = seededEventItems.filter(
    (seededItem) => !items.some((item) => item.id === seededItem.id),
  );
  return { quickFirePanels: panelsAfter, items: [...items, ...itemsMissing] };
}

/**
 * The items and rules of a database seeded before BAJAOVRLAY-35, with the "Super Chat" item
 * added to "Avisos" (after its last item) and the Super Chat rule naming it, or undefined
 * when nothing is to change. Added only when the rule still has no item and no item of its
 * id exists: a rule whose operator chose another item keeps it, and so does one set to no
 * item after the seed (the item is still there), so it is added once. Not added either when
 * the operator deleted "Avisos": a deleted panel is never brought back for it.
 * What could go wrong: an operator who deletes the item and then sets the rule to no item
 * gets it back at the next boot; deleting the item alone leaves the rule naming it, and
 * that is never re-seeded.
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
    .filter((item) => item.home.kind === 'quickFire' && item.home.panelId === eventsQuickFirePanelId)
    .map((item) => item.order);
  const itemAdded: Item = { ...seededSuperChatItem, order: Math.max(-1, ...ordersInThePanel) + 1 };
  const rulesAfter = eventRules.map((rule) =>
    rule.kind === 'superChat' ? { ...rule, itemId: superChatItemId } : rule,
  );
  return { eventRules: rulesAfter, items: [...items, itemAdded] };
}

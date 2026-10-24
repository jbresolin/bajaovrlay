import type { Item, QuickFirePanel } from '@bajaovrlay/shared';

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

/**
 * The two notice items (BAJAOVRLAY-44), on the notice graphic and the notice layer, in the
 * "Avisos" panel. Every field the event fills is an event field, so they are templates:
 * they go on air only through an event, and Prévia shows them filled from a sample.
 * The fastest-lap variant reads the lap and its time; the penalty variant the kind of
 * notice, the reason and the penalty. Both read the car, its team and its school.
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
];

/**
 * The panels and items with the "Avisos" panel (after the last panel) and its two items
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

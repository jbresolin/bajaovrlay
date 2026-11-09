import type { EventRule } from '@bajaovrlay/shared';

import { fastestLapItemId, penaltyItemId, superChatItemId } from './seedEventItems.js';

/**
 * The rules a new database starts with, João's call in the brief of BAJAOVRLAY-44:
 * - penalties (and every incident) wait for the operator, 10 s on air;
 * - a new fastest lap goes on air by itself for 8 s, and expires when it could not be
 *   shown within 2 minutes (old news);
 * - a leader change is ignored until a notice is designed for it (gate 2 of PR #22); set
 *   to auto in "Regras", it shows for 6 s and expires after 2 minutes;
 * - a manual event waits for the operator, 10 s on air;
 * - a Super Chat (BAJAOVRLAY-35) only ever asks, 15 s on air.
 * A rule that asks has no max age: the operator decides however long it takes. Fastest
 * laps are shown with the seeded "Volta mais rápida", incidents and manual events with
 * "Penalidade" (seedEventItems.ts), Super Chats with "Super Chat" (BAJAOVRLAY-35). Leader
 * changes have no item: PR #21 designs no notice for them yet.
 */
export const seededEventRules: EventRule[] = [
  { kind: 'newIncident', mode: 'ask', itemId: penaltyItemId, durationMs: 10_000, maxAgeMs: null },
  {
    kind: 'fastestLap',
    mode: 'auto',
    itemId: fastestLapItemId,
    durationMs: 8_000,
    maxAgeMs: 120_000,
  },
  { kind: 'leaderChanged', mode: 'ignore', itemId: null, durationMs: 6_000, maxAgeMs: 120_000 },
  { kind: 'manual', mode: 'ask', itemId: penaltyItemId, durationMs: 10_000, maxAgeMs: null },
  {
    kind: 'superChat',
    mode: 'ask',
    itemId: superChatItemId,
    durationMs: 15_000,
    maxAgeMs: null,
  },
];

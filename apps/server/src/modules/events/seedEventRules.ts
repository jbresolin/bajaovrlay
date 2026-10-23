import type { EventRule } from '@bajaovrlay/shared';

/**
 * The rules a new database starts with, João's call in the brief of BAJAOVRLAY-44:
 * - penalties (and every incident) wait for the operator, 10 s on air;
 * - a new fastest lap goes on air by itself for 8 s, a leader change for 6 s, and either
 *   expires when it could not be shown within 2 minutes (old news);
 * - a manual event waits for the operator, 10 s on air;
 * - a Super Chat (BAJAOVRLAY-35) only ever asks, 15 s on air.
 * A rule that asks has no max age: the operator decides however long it takes. No item is
 * chosen here: until one is chosen in "Regras", nothing of that kind can go on air.
 */
export const seededEventRules: EventRule[] = [
  { kind: 'newIncident', mode: 'ask', itemId: null, durationMs: 10_000, maxAgeMs: null },
  { kind: 'fastestLap', mode: 'auto', itemId: null, durationMs: 8_000, maxAgeMs: 120_000 },
  { kind: 'leaderChanged', mode: 'auto', itemId: null, durationMs: 6_000, maxAgeMs: 120_000 },
  { kind: 'manual', mode: 'ask', itemId: null, durationMs: 10_000, maxAgeMs: null },
  { kind: 'superChat', mode: 'ask', itemId: null, durationMs: 15_000, maxAgeMs: null },
];

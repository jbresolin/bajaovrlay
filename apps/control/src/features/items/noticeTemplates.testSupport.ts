// Test support: the notice graphic with its real manifest, and the event templates on it
// as the server seeds them (BAJAOVRLAY-44, in "Modelos de evento" since BAJAOVRLAY-67),
// on slices whose rules name them. Every function builds new objects on each call.
import noticeManifest from '@bajaovrlay/notice/notice.ograf.json';
import type { EventRule, Graphic, Item, Slices } from '@bajaovrlay/shared';

import { buildSlicesWithTheRaceClockAndTheLowerThird } from './itemsLikeTheEditorSaves.testSupport';

/** The notice, as the editor's "Gráfico" dropdown names it (its manifest's name). */
export const noticeGraphicName = 'Aviso';

/** The notice as the server registers it once its package is built. */
export function buildNoticeGraphic(): Graphic {
  return {
    id: 'notice',
    manifest: structuredClone(noticeManifest),
    defaultLayerId: 'notice',
    category: 'notice',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** "Penalidade" as the server seeds it: every field but the variant read from the event. */
export function buildSeededPenaltyTemplate(): Item {
  return {
    id: 'penalidade',
    home: { kind: 'eventTemplates' },
    order: 1,
    graphicId: 'notice',
    layerId: 'notice',
    label: 'Penalidade',
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
  };
}

/** "Volta mais rápida" as the server seeds it. */
export function buildSeededFastestLapTemplate(): Item {
  return {
    id: 'volta-mais-rapida',
    home: { kind: 'eventTemplates' },
    order: 0,
    graphicId: 'notice',
    layerId: 'notice',
    label: 'Volta mais rápida',
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
  };
}

/**
 * The rules as João's defaults name the seeded templates: incidents and typed events with
 * "Penalidade", fastest laps with "Volta mais rápida", the Super Chat with the item given
 * (none when left out), leader changes with none.
 */
export function buildRulesNamingTheSeededTemplates(
  superChatItemId: string | null = null,
): EventRule[] {
  return [
    { kind: 'newIncident', mode: 'ask', itemId: 'penalidade', durationMs: 10_000, maxAgeMs: null },
    {
      kind: 'fastestLap',
      mode: 'auto',
      itemId: 'volta-mais-rapida',
      durationMs: 8_000,
      maxAgeMs: 120_000,
    },
    { kind: 'leaderChanged', mode: 'ignore', itemId: null, durationMs: 6_000, maxAgeMs: 120_000 },
    { kind: 'manual', mode: 'ask', itemId: 'penalidade', durationMs: 10_000, maxAgeMs: null },
    { kind: 'superChat', mode: 'ask', itemId: superChatItemId, durationMs: 15_000, maxAgeMs: null },
  ];
}

/**
 * The editor's usual slices (the race clock, the lower third) with the notice graphic, the
 * two seeded notice templates, the items given, and the rules given (the defaults when
 * left out).
 */
export function buildSlicesWithTheNoticeTemplates(
  moreItems: Item[] = [],
  eventRules: EventRule[] = buildRulesNamingTheSeededTemplates(),
): Slices {
  const slices = buildSlicesWithTheRaceClockAndTheLowerThird();
  return {
    ...slices,
    // The notice layer, between the clock and the lower third, as the server seeds it.
    layers: [
      ...slices.layers,
      {
        id: 'notice',
        outputId: 'program',
        name: 'Aviso',
        zIndex: 45,
        replacePolicy: 'out-then-in',
        persistent: false,
      },
    ],
    graphics: [...slices.graphics, buildNoticeGraphic()],
    items: [
      ...slices.items,
      buildSeededFastestLapTemplate(),
      buildSeededPenaltyTemplate(),
      ...moreItems,
    ],
    eventRules,
  };
}

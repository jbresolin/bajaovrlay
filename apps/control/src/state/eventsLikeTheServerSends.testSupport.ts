/**
 * Test support: the event inbox as the server sends it (BAJAOVRLAY-44), with realistic
 * events of the 2027 enduro, the two notice templates in "Modelos de evento"
 * (BAJAOVRLAY-67) and João's default rules naming them, and three teams of Cadastros.
 * Every function builds fresh objects, so a test can change one thing.
 */
import type { EventRule, InboxEvent, Item, Slices, Team } from '@bajaovrlay/shared';

import { buildSlicesWithShortcutsAndMacros } from './quickFireLikeTheServerSends.testSupport';

/** 14:10 UTC on 14 August 2027: "now" in the inbox tests (they set the page's clock to it). */
export const nowInTheInboxTests = new Date('2027-08-14T14:10:00.000Z');

/** A moment `minutesAgo` minutes before nowInTheInboxTests, in ms. */
function minutesBeforeNowMs(minutesAgo: number): number {
  return nowInTheInboxTests.getTime() - minutesAgo * 60_000;
}

/** The two notice templates the server seeds in "Modelos de evento". */
export function buildNoticeItems(): Item[] {
  return [
    {
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
      },
    },
    {
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
        carNumber: { kind: 'eventField', path: 'carNumber' },
      },
    },
  ];
}

/** João's default rules, with the seeded notice items. */
export function buildDefaultEventRules(): EventRule[] {
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
    { kind: 'superChat', mode: 'ask', itemId: null, durationMs: 15_000, maxAgeMs: null },
  ];
}

/** Car 47's start penalty, waiting for the operator since `minutesAgo` minutes. */
export function buildPendingPenaltyOfCar47(minutesAgo: number): InboxEvent {
  const detectedAtMs = minutesBeforeNowMs(minutesAgo);
  return {
    eventId: 'simulador-enduro:incident:ocorrencia-0007',
    kind: 'newIncident',
    sourceId: 'simulador-enduro',
    detectedAtMs,
    payload: {
      carNumber: 47,
      teamName: 'Carnaúba Baja',
      schoolName: 'UFERSA',
      noticeKind: 'penalty',
      reason: 'Queima de largada',
      penaltyText: '+30 segundos',
      lapNumber: 1,
    },
    status: 'pending',
    statusChanges: [{ status: 'pending', atMs: detectedAtMs }],
  };
}

/** Car 38's blocking warning, waiting for the operator since `minutesAgo` minutes. */
export function buildPendingWarningOfCar38(minutesAgo: number): InboxEvent {
  const detectedAtMs = minutesBeforeNowMs(minutesAgo);
  return {
    eventId: 'simulador-enduro:incident:ocorrencia-0012',
    kind: 'newIncident',
    sourceId: 'simulador-enduro',
    detectedAtMs,
    payload: {
      carNumber: 38,
      teamName: 'Coruja Racing',
      schoolName: 'EESC-USP',
      noticeKind: 'warning',
      reason: 'Bloqueio de ultrapassagem',
    },
    status: 'pending',
    statusChanges: [{ status: 'pending', atMs: detectedAtMs }],
  };
}

/** Car 31's fastest lap, queued for the runner since `minutesAgo` minutes. */
export function buildQueuedFastestLapOfCar31(minutesAgo: number): InboxEvent {
  const detectedAtMs = minutesBeforeNowMs(minutesAgo);
  return {
    eventId: 'simulador-enduro:fastestLap:enduro-2027-nacional:31:34',
    kind: 'fastestLap',
    sourceId: 'simulador-enduro',
    detectedAtMs,
    payload: {
      carNumber: 31,
      teamName: 'Acauã Baja',
      schoolName: 'Mauá',
      lapNumber: 34,
      lapTimeMs: 278_291,
      lapTimeText: '4:38,2',
    },
    status: 'queued',
    statusChanges: [{ status: 'queued', atMs: detectedAtMs }],
  };
}

/**
 * An event that is over, `minutesAgo` minutes ago: car 52's leader change, with the
 * status given (shown, dismissed or expired).
 */
export function buildFinishedLeaderChangeOfCar52(
  minutesAgo: number,
  status: 'shown' | 'dismissed' | 'expired',
): InboxEvent {
  const detectedAtMs = minutesBeforeNowMs(minutesAgo);
  return {
    eventId: `simulador-enduro:leaderChanged:enduro-2027-nacional:52:${String(minutesAgo)}`,
    kind: 'leaderChanged',
    sourceId: 'simulador-enduro',
    detectedAtMs,
    payload: { carNumber: 52, teamName: 'Pequi Off-Road', schoolName: 'UFG', lapNumber: 20 },
    status,
    statusChanges: [
      { status: 'queued', atMs: detectedAtMs },
      { status, atMs: detectedAtMs + 1_000 },
    ],
  };
}

/**
 * Car 47's start penalty, arrived 2 minutes ago and dismissed `secondsAgo` seconds before
 * nowInTheInboxTests: what "Desfazer" on the console can still undo when it is recent.
 */
export function buildPenaltyOfCar47DismissedSecondsAgo(secondsAgo: number): InboxEvent {
  const penalty = buildPendingPenaltyOfCar47(2);
  return {
    ...penalty,
    status: 'dismissed',
    statusChanges: [
      ...penalty.statusChanges,
      { status: 'dismissed', atMs: nowInTheInboxTests.getTime() - secondsAgo * 1_000 },
    ],
  };
}

/**
 * A notice the operator typed about car 12 `minutesAgo` minutes ago ("+ Evento", no
 * source), shown and over.
 */
export function buildShownManualNoticeOfCar12(minutesAgo: number): InboxEvent {
  const detectedAtMs = minutesBeforeNowMs(minutesAgo);
  return {
    eventId: 'manual:aviso-carro-12',
    kind: 'manual',
    sourceId: null,
    detectedAtMs,
    payload: {
      carNumber: 12,
      teamName: 'Tatu Baja',
      schoolName: 'UNESP',
      noticeKind: 'notice',
      reason: 'Troca de piloto no box',
    },
    status: 'shown',
    statusChanges: [
      { status: 'pending', atMs: detectedAtMs },
      { status: 'onAir', atMs: detectedAtMs + 20_000 },
      { status: 'shown', atMs: detectedAtMs + 30_000 },
    ],
  };
}

/**
 * Three teams of Cadastros, as the entity library holds them (out of car-number order, as
 * an import may leave them): car 47 Carnaúba Baja (UFERSA), car 12 Gralha Azul Baja (UTFPR)
 * and car 31 Acauã Baja (Mauá).
 */
export function buildTeamsOfCadastros(): Team[] {
  return [
    { carNumber: 47, teamName: 'Carnaúba Baja', schoolName: 'UFERSA' },
    { carNumber: 12, teamName: 'Gralha Azul Baja', schoolName: 'UTFPR' },
    { carNumber: 31, teamName: 'Acauã Baja', schoolName: 'Mauá' },
  ];
}

/**
 * The strip's slices (panels "Atalhos" and "Box", the macros) plus the two notice templates
 * in "Modelos de evento", the default rules, the events given, and the teams given (none
 * when left out).
 */
export function buildSlicesWithTheInbox(events: InboxEvent[], teams: Team[] = []): Slices {
  const slices = buildSlicesWithShortcutsAndMacros();
  return {
    ...slices,
    items: [...slices.items, ...buildNoticeItems()],
    eventRules: buildDefaultEventRules(),
    events,
    teams,
  };
}

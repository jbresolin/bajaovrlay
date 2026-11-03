/**
 * Test support: triggers as the server sends them (BAJAOVRLAY-48), on the inbox's slices
 * of the 2027 enduro: two triggers ("Entrou no box", a scene entered, by itself; "Botão
 * da mesa", an HTTP call that asks), OBS connected, the Enduro in Programação, and
 * firings that wait or were just dismissed. Every function builds fresh objects.
 */
import type { ObsSlice, ScheduleSlot, Slices, Trigger, TriggerFiring } from '@bajaovrlay/shared';

import {
  buildSlicesWithTheInbox,
  nowInTheInboxTests,
} from './eventsLikeTheServerSends.testSupport';
import {
  closeTheSessionMacroId,
  openTheSessionMacroId,
} from './quickFireLikeTheServerSends.testSupport';

/** The ids of the two triggers. */
export const boxEnteredTriggerId = 'gatilho-entrou-no-box';
export const deskButtonTriggerId = 'gatilho-botao-da-mesa';

/** The id of the Enduro's slot in Programação. */
export const enduroSlotId = 'enduro-sabado';

/** "Entrou no box": the scene Box entered runs "Abrir a sessão" by itself. */
export function buildBoxEnteredTrigger(): Trigger {
  return {
    id: boxEnteredTriggerId,
    name: 'Entrou no box',
    isEnabled: true,
    when: { kind: 'obsScene', change: 'entered', sceneName: 'Box' },
    macroId: openTheSessionMacroId,
    mode: 'auto',
    minimumIntervalMs: 10_000,
  };
}

/** "Botão da mesa": the D200's HTTP call asks before running "Fechar a sessão". */
export function buildDeskButtonTrigger(): Trigger {
  return {
    id: deskButtonTriggerId,
    name: 'Botão da mesa',
    isEnabled: true,
    when: { kind: 'http' },
    macroId: closeTheSessionMacroId,
    mode: 'ask',
    minimumIntervalMs: 30_000,
  };
}

/** OBS on the stream PC, connected, the track on Program. */
export function buildObsConnectedOnTheTrack(): ObsSlice {
  return {
    connectionState: 'conectado',
    address: 'ws://127.0.0.1:4455',
    lastError: null,
    sceneNames: ['Pista', 'Box', 'Pódio', 'Intervalo'],
    programSceneName: 'Pista',
    isStudioModeOn: false,
    previewSceneName: null,
    sceneSwitch: null,
  };
}

/** The Enduro, 13:00 to 17:00 in São Paulo on race day. */
export function buildEnduroSlot(): ScheduleSlot {
  return {
    slotId: enduroSlotId,
    sessionName: 'Enduro',
    sessionKind: 'enduro',
    startsAtMs: Date.parse('2027-08-14T16:00:00.000Z'),
    endsAtMs: Date.parse('2027-08-14T20:00:00.000Z'),
    place: 'Pista principal',
  };
}

/** A firing of "Botão da mesa" that waits, carrying Ana Souza's name, `minutesAgo` minutes ago. */
export function buildPendingDeskButtonFiring(minutesAgo: number): TriggerFiring {
  const firedAtMs = nowInTheInboxTests.getTime() - minutesAgo * 60_000;
  return {
    firingId: 'disparo-ana-souza',
    triggerId: deskButtonTriggerId,
    triggerName: 'Botão da mesa',
    macroId: closeTheSessionMacroId,
    data: { nome: 'Ana Souza', carro: 47 },
    firedAtMs,
    status: 'pending',
    statusChangedAtMs: firedAtMs,
    autoRunRefusal: null,
  };
}

/** A firing of "Entrou no box" that could not run by itself: another macro was running. */
export function buildBoxEnteredFiringThatHadToAsk(): TriggerFiring {
  const firedAtMs = nowInTheInboxTests.getTime() - 60_000;
  return {
    firingId: 'disparo-box-ocupado',
    triggerId: boxEnteredTriggerId,
    triggerName: 'Entrou no box',
    macroId: openTheSessionMacroId,
    data: { cena: 'Box' },
    firedAtMs,
    status: 'pending',
    statusChangedAtMs: firedAtMs,
    autoRunRefusal:
      'A macro "Abrir a sessão" não pode começar enquanto a macro "Fechar a sessão" está rodando.',
  };
}

/** The firing of "Botão da mesa" dismissed `secondsAgo` seconds ago. */
export function buildDeskButtonFiringDismissedSecondsAgo(secondsAgo: number): TriggerFiring {
  return {
    ...buildPendingDeskButtonFiring(5),
    status: 'dismissed',
    statusChangedAtMs: nowInTheInboxTests.getTime() - secondsAgo * 1_000,
  };
}

/**
 * The inbox's slices with the two triggers, OBS on the track, the Enduro in Programação,
 * the given firings, and the pause as given.
 */
export function buildSlicesWithTheTriggers(
  firings: TriggerFiring[] = [],
  isPaused = false,
): Slices {
  return {
    ...buildSlicesWithTheInbox([]),
    obs: buildObsConnectedOnTheTrack(),
    scheduleSlots: [buildEnduroSlot()],
    triggers: [buildBoxEnteredTrigger(), buildDeskButtonTrigger()],
    triggerActivity: { isPaused, lastFiredAtMsByTriggerId: {}, firings },
  };
}

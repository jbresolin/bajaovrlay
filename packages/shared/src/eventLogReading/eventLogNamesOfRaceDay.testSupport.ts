// Test support: the names a race day gives the history sentences. Two outputs (Programa
// and PiP), the seeded layers the sentences name, two items, a macro, the panel "Atalhos",
// the main rundown, the simulator, two inbox events, Ana Souza's lower third on air, and
// the trigger "Entrou no box" with one firing waiting for the operator.
// Every function builds fresh objects on each call.
import type { DataSource } from '../dataSources/dataSource.js';
import type { InboxEvent } from '../eventInbox/inboxEventsSlice.js';
import type { Item } from '../rundown/item.js';
import type { Instance } from '../slices/instance.js';
import type { Layer } from '../slices/layer.js';
import type { Trigger } from '../triggers/trigger.js';
import type { TriggerActivity } from '../triggers/triggerActivity.js';
import type { EventLogNames } from './eventLogNames.js';

/** Builds a layer of the given output; the sentences read only its id, name and output. */
function buildLayer(id: string, name: string, outputId: string, zIndex: number): Layer {
  return { id, outputId, name, zIndex, replacePolicy: 'out-then-in', persistent: false };
}

/** "Tarja – Ana Souza": the team 42 driver's lower third, a button of "Atalhos". */
function buildAnaSouzaLowerThirdItem(): Item {
  return {
    id: 'item-tarja-ana-souza',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    order: 0,
    graphicId: 'team-lower-third',
    layerId: 'lower-third',
    fields: { personName: { kind: 'literal', value: 'Ana Souza' } },
    label: 'Tarja – Ana Souza',
    color: 'info',
    notes: '',
  };
}

/** "Relógio – Enduro": the race clock in the main rundown. */
function buildEnduroClockItem(): Item {
  return {
    id: 'item-relogio-enduro',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    order: 0,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: { sessionName: { kind: 'literal', value: 'Enduro de Resistência' } },
    label: 'Relógio – Enduro',
    color: 'success',
    notes: '',
  };
}

/** "Simulador — Enduro", on and healthy. */
function buildSimulatorSource(): DataSource {
  return {
    id: 'simulador-enduro',
    label: 'Simulador — Enduro',
    kind: 'simulator',
    config: {
      seed: 2027,
      carCount: 60,
      sessionDurationMs: 14_400_000,
      lapLengthKm: 2,
      speed: 1,
      isFailing: false,
      simulatedStartAtMs: Date.parse('2026-10-09T13:00:00.000Z'),
    },
    pollIntervalMs: 2_000,
    isEnabled: true,
    isRecording: false,
    status: {
      lastAttemptAtMs: Date.parse('2026-10-09T14:32:03.000Z'),
      lastOkAtMs: Date.parse('2026-10-09T14:32:03.000Z'),
      lastError: null,
      consecutiveFailures: 0,
      isStale: false,
      staleAfterMs: 6_000,
      recordingError: null,
    },
  };
}

/** Builds an inbox event waiting for the operator: its kind, car and id. */
function buildWaitingEvent(eventId: string, kind: InboxEvent['kind'], carNumber: number) {
  const detectedAtMs = Date.parse('2026-10-09T14:31:50.000Z');
  const inboxEvent: InboxEvent = {
    eventId,
    kind,
    sourceId: 'simulador-enduro',
    detectedAtMs,
    payload: { carNumber, teamName: 'Acauã Baja' },
    status: 'pending',
    statusChanges: [{ status: 'pending', atMs: detectedAtMs }],
  };
  return inboxEvent;
}

/** A general notice typed in "+ Evento", about no car (BAJAOVRLAY-67). */
function buildWaitingGeneralNotice(): InboxEvent {
  const detectedAtMs = Date.parse('2026-10-09T14:33:00.000Z');
  return {
    eventId: 'manual:aviso-largada-adiada',
    kind: 'manual',
    sourceId: null,
    detectedAtMs,
    payload: { noticeKind: 'notice', reason: 'Largada adiada em 15 minutos' },
    status: 'pending',
    statusChanges: [{ status: 'pending', atMs: detectedAtMs }],
  };
}

/** A fictional viewer's Super Chat of R$ 20,00, waiting for approval (BAJAOVRLAY-35). */
function buildWaitingSuperChat(): InboxEvent {
  const detectedAtMs = Date.parse('2026-10-09T14:32:10.000Z');
  return {
    eventId: 'youtube-ao-vivo:superChat:mensagem-pequi-0001',
    kind: 'superChat',
    sourceId: 'youtube-ao-vivo',
    detectedAtMs,
    payload: {
      authorName: 'Torcida Pequi Off-Road',
      amountText: 'R$ 20,00',
      messageText: 'Vai, Pequi! Abraço de Goiânia',
    },
    status: 'pending',
    statusChanges: [{ status: 'pending', atMs: detectedAtMs }],
  };
}

/** Ana Souza's lower third on the program output of "Tarja". */
function buildAnaSouzaOnAir(): Instance {
  return {
    id: 'instancia-tarja-ana-souza',
    layerId: 'lower-third',
    graphicId: 'team-lower-third',
    target: 'program',
    resolvedData: { personName: 'Ana Souza' },
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-09T14:32:00.000Z',
    itemId: 'item-tarja-ana-souza',
  };
}

/** "Entrou no box": the scene Box entered runs "Entrevista no box", asking first. */
function buildBoxEnteredTrigger(): Trigger {
  return {
    id: 'gatilho-entrou-no-box',
    name: 'Entrou no box',
    isEnabled: true,
    when: { kind: 'obsScene', change: 'entered', sceneName: 'Box' },
    macroId: 'macro-entrevista-no-box',
    mode: 'ask',
    minimumIntervalMs: 10_000,
  };
}

/** The Eventos tab's one waiting firing: Box entered, a minute after Ana Souza went on air. */
function buildActivityWithTheBoxFiringWaiting(): TriggerActivity {
  const firedAtMs = Date.parse('2026-10-09T14:33:00.000Z');
  return {
    isPaused: false,
    lastFiredAtMsByTriggerId: { 'gatilho-entrou-no-box': firedAtMs },
    firings: [
      {
        firingId: 'disparo-box-1',
        triggerId: 'gatilho-entrou-no-box',
        triggerName: 'Entrou no box',
        macroId: 'macro-entrevista-no-box',
        data: { cena: 'Box' },
        firedAtMs,
        status: 'pending',
        statusChangedAtMs: firedAtMs,
        autoRunRefusal: null,
      },
    ],
  };
}

/** The names of the race day, as the history page reads them from its slices. */
export function buildEventLogNamesOfRaceDay(): EventLogNames {
  return {
    outputs: [
      { outputId: 'program', name: 'Programa', order: 0 },
      { outputId: 'pip', name: 'PiP', order: 1 },
    ],
    layers: [
      buildLayer('clock', 'Relógio', 'program', 30),
      buildLayer('lower-third', 'Tarja', 'program', 40),
      buildLayer('notice', 'Aviso', 'program', 45),
      buildLayer('fullscreen', 'Tela cheia', 'program', 50),
      buildLayer('camera-do-box', 'Câmera do box', 'pip', 10),
    ],
    items: [buildAnaSouzaLowerThirdItem(), buildEnduroClockItem()],
    macros: [
      { id: 'macro-abertura', label: 'Abertura', color: 'highlight', steps: [] },
      { id: 'macro-entrevista-no-box', label: 'Entrevista no box', color: 'info', steps: [] },
    ],
    quickFirePanels: [{ id: 'atalhos', name: 'Atalhos', order: 0 }],
    rundowns: [
      {
        id: 'sessao-principal',
        name: 'Sessão principal',
        sessionLabel: 'Enduro',
        cursorItemId: null,
      },
    ],
    dataSources: [buildSimulatorSource()],
    events: [
      buildWaitingEvent('evento-volta-31', 'fastestLap', 31),
      buildWaitingEvent('evento-ocorrencia-47', 'newIncident', 47),
      buildWaitingSuperChat(),
      buildWaitingGeneralNotice(),
    ],
    instances: [buildAnaSouzaOnAir()],
    triggers: [buildBoxEnteredTrigger()],
    triggerActivity: buildActivityWithTheBoxFiringWaiting(),
  };
}

// Test support: the names a race day gives the history sentences. Two outputs (Programa
// and PiP), the seeded layers the sentences name, two items, a macro, the panel "Atalhos",
// the main rundown, the simulator, two inbox events and Ana Souza's lower third on air.
// Every function builds fresh objects on each call.
import type { DataSource } from '../dataSources/dataSource.js';
import type { InboxEvent } from '../eventInbox/inboxEventsSlice.js';
import type { Item } from '../rundown/item.js';
import type { Instance } from '../slices/instance.js';
import type { Layer } from '../slices/layer.js';
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
    macros: [{ id: 'macro-abertura', label: 'Abertura', color: 'highlight', steps: [] }],
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
    ],
    instances: [buildAnaSouzaOnAir()],
  };
}

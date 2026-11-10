// Test support: a real store on a temporary SQLite file, holding the real manifests of the
// lower third, the notice, the countdown and the plain sponsor roll, four items that use
// them, the macros the brief's examples run, the macro runner, the trigger service and, when
// a test asks, the auto-out, all on Vitest's fake
// time (the clock and every timer move only when a test moves them). Every call builds its
// own store, database and service, so no test can change what another test sees.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { MacroStep, ObsStatus, TriggerFiring } from '@bajaovrlay/shared';
import { expect, onTestFinished, vi } from 'vitest';

import { openTemporaryDatabase } from '../../core/db/temporaryDatabase.testSupport.js';
import {
  createRecordingLogger,
  type RecordedLogLine,
} from '../../core/logger/recordingLogger.testSupport.js';
import { startAutoOutScheduler } from '../../core/store/autoOut.js';
import { createGraphicsFolderWithUnbuiltRaceClock } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { obsConnectionActor } from '../../core/store/commandActors.js';
import { createStateStore, type StateStore } from '../../core/store/createStateStore.js';
import { startMacroRunner } from '../../core/store/macroRunner.js';
import { startTriggerService } from './service.js';

/** The operator's actor in these tests: one control page's connection. */
export const operatorActor = 'operador:conexao-12';

/** Saturday of the 2027 national, 11:00 in São Paulo (14:00 UTC): before the Enduro. */
export const startOfRaceDay = '2027-08-14T14:00:00.000Z';

/** The four items the macros take, by id. */
export const lowerThirdItemId = 'item-entrevistado-no-box';
export const penaltyNoticeItemId = 'item-aviso-de-penalidade';
export const countdownItemId = 'item-contagem-do-enduro';
export const plainSponsorRollItemId = 'item-patrocinadores-simples';

/** The macros of the brief's examples, by id. */
export const interviewInTheBoxMacroId = 'macro-entrevista-no-box';
export const trackReplayMacroId = 'macro-replay-da-pista';
export const penaltyNoticeMacroId = 'macro-aviso-de-penalidade';
export const enduroCountdownMacroId = 'macro-contagem-do-enduro';
export const goToTheBoxMacroId = 'macro-ir-para-o-box';
export const plainSponsorRollMacroId = 'macro-patrocinadores-simples';

/**
 * How long the plain roll's pass lasts with its two sponsors (BAJAOVRLAY-64): the 0,4 s
 * entrance, Bosch's 8 s (Diamante) and SAE Brasil's 5 s (Realização).
 */
export const plainSponsorRollPassMs = 13_400;

/** The graphics whose real manifests the store registers, by package folder. */
const graphicFoldersUsed = ['lower-third', 'notice', 'countdown', 'sponsor-roll-plain'];

/** packages/graphics in this repository, where the real manifests are. */
const repositoryGraphicsFolder = fileURLToPath(
  new URL('../../../../../packages/graphics/', import.meta.url),
);

/**
 * A temporary graphics folder with the lower third, the notice, the countdown and the plain
 * sponsor roll "built": their real manifests copied into dist/, so a take here is refused or
 * accepted exactly as on race day.
 */
function createGraphicsFolderWithTheRealGraphicsOfTheMacros(): string {
  const graphicsFolder = createGraphicsFolderWithUnbuiltRaceClock();
  for (const folderName of graphicFoldersUsed) {
    const manifestText = readFileSync(
      join(repositoryGraphicsFolder, folderName, `${folderName}.ograf.json`),
      'utf8',
    );
    const distFolder = join(graphicsFolder, folderName, 'dist');
    mkdirSync(distFolder, { recursive: true });
    writeFileSync(join(distFolder, `${folderName}.ograf.json`), manifestText);
  }
  return graphicsFolder;
}

/** Applies a command as the operator and fails the test at once if it is refused. */
export function applyAsTheOperatorOrThrow(store: StateStore, command: unknown): void {
  const outcome = store.applyCommand(command, operatorActor);
  if (!outcome.ok) {
    throw new Error(`the setup command was refused: ${outcome.error.message}`);
  }
}

/** Creates the four items the macros take, each with plain values of its own. */
function createTheItemsOfTheMacros(store: StateStore): void {
  const home = { kind: 'quickFire', panelId: 'atalhos' };
  applyAsTheOperatorOrThrow(store, {
    type: 'createItem',
    home,
    graphicId: 'lower-third',
    layerId: 'lower-third',
    label: 'Entrevistado no box',
    fields: {
      name: { kind: 'literal', value: 'Convidado do box' },
      role: { kind: 'literal', value: 'Entrevista' },
    },
  });
  applyAsTheOperatorOrThrow(store, {
    type: 'createItem',
    home,
    graphicId: 'notice',
    layerId: 'notice',
    label: 'Aviso de penalidade',
    fields: {
      variant: { kind: 'literal', value: 'penalty' },
      carNumber: { kind: 'literal', value: 1 },
      reason: { kind: 'literal', value: 'Penalidade aplicada' },
    },
  });
  applyAsTheOperatorOrThrow(store, {
    type: 'createItem',
    home,
    graphicId: 'countdown',
    layerId: 'clock',
    label: 'Contagem do Enduro',
    fields: {
      layout: { kind: 'literal', value: 'card' },
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      startsAtMs: { kind: 'literal', value: Date.parse('2027-08-14T16:00:00.000Z') },
    },
  });
  applyAsTheOperatorOrThrow(store, {
    type: 'createItem',
    home,
    graphicId: 'sponsor-roll-plain',
    layerId: 'bug',
    label: 'Patrocinadores (simples)',
    fields: {
      sponsors: {
        kind: 'literal',
        value: [
          { name: 'Bosch', level: 'diamante', logoUrl: '/media/logo-bosch.png' },
          { name: 'SAE Brasil', level: 'realizacao', logoUrl: '/media/logo-sae.png' },
        ],
      },
      corner: { kind: 'literal', value: 'top-left' },
    },
  });
}

/** "Entrevista no box" taking the lower third with its name from the trigger's `nome`. */
export const interviewNameFromTheTriggerSteps: MacroStep[] = [
  {
    kind: 'takeItem',
    itemId: lowerThirdItemId,
    triggerFields: { name: { kind: 'triggerData', key: 'nome' } },
  },
];

/** The steps of each macro the tests run, by id; a test may replace any of them. */
export type MacroStepsOfTheTests = Partial<Record<string, MacroStep[]>>;

/** The macros of the brief's examples, as the operator would save them. */
function buildDefaultMacroSteps(): Record<string, MacroStep[]> {
  return {
    // The item's own values; interviewNameFromTheTriggerSteps fills the name instead.
    [interviewInTheBoxMacroId]: [{ kind: 'takeItem', itemId: lowerThirdItemId }],
    [trackReplayMacroId]: [{ kind: 'clearLayer', layerId: 'lower-third' }],
    [penaltyNoticeMacroId]: [
      {
        kind: 'takeItem',
        itemId: penaltyNoticeItemId,
        triggerFields: {
          carNumber: { kind: 'triggerData', key: 'carro' },
          teamName: { kind: 'triggerData', key: 'equipe' },
          reason: { kind: 'triggerData', key: 'motivo' },
        },
      },
    ],
    [enduroCountdownMacroId]: [
      {
        kind: 'takeItem',
        itemId: countdownItemId,
        triggerFields: {
          sessionName: { kind: 'triggerData', key: 'sessao' },
          startsAtMs: { kind: 'triggerData', key: 'inicio' },
        },
      },
    ],
    [goToTheBoxMacroId]: [{ kind: 'obsScene', sceneName: 'Box', target: 'program' }],
    [plainSponsorRollMacroId]: [{ kind: 'takeItem', itemId: plainSponsorRollItemId }],
  };
}

/** The pt-BR label of each macro, as its button reads. */
const labelOfEachMacro: Record<string, string> = {
  [interviewInTheBoxMacroId]: 'Entrevista no box',
  [trackReplayMacroId]: 'Replay da pista',
  [penaltyNoticeMacroId]: 'Aviso de penalidade',
  [enduroCountdownMacroId]: 'Contagem do Enduro',
  [goToTheBoxMacroId]: 'Ir para o box',
  [plainSponsorRollMacroId]: 'Patrocinadores (simples)',
};

/** What a test drives and reads. */
export type TriggersOnTheStore = {
  store: StateStore;
  /** The database file, for a test that restarts the server on it. */
  databasePath: string;
  /** Moves the fake clock and every fake timer on by this many ms, running what falls due. */
  passTime: (milliseconds: number) => void;
  /**
   * Moves the fake clock on by this many ms without running any timer, as a laptop that
   * slept: the next passTime runs the first tick after it woke.
   */
  sleep: (milliseconds: number) => void;
  /** Moves the fake clock back by this many ms at once, as a step of the server clock back. */
  stepTheClockBack: (milliseconds: number) => void;
  /** Every line the store, the macro runner and the trigger service have logged. */
  readRecordedLogLines: () => RecordedLogLine[];
};

/**
 * Builds what every trigger test starts from: the fake clock at 11:00 in São Paulo on race
 * day, a store on a fresh database with the four items and six macros (the steps of any
 * may be replaced), the macro runner and the trigger service, and the auto-out when
 * `isAutoOutRunning` (the plain roll then leaves after its pass). Trigger ids are
 * `gatilho-1`, `gatilho-2`…, firing ids `disparo-1`, `disparo-2`…, counted from what the
 * store holds (a test that deletes a trigger and creates another would reuse an id).
 */
export function startTriggersOnTheStore(
  options: { macroSteps?: MacroStepsOfTheTests; isAutoOutRunning?: boolean } = {},
): TriggersOnTheStore {
  vi.useFakeTimers({ now: Date.parse(startOfRaceDay) });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  // The store and the trigger service read the faked Date, which `sleep` steps on its
  // own; the server clock's own behaviour is tested in core/time.
  const readTheFakedWallClock = () => new Date();
  const { database, databasePath } = openTemporaryDatabase();
  const itemIdsInCreationOrder = [
    lowerThirdItemId,
    penaltyNoticeItemId,
    countdownItemId,
    plainSponsorRollItemId,
  ];
  // The store asks for every kind of id at every command, so an id is chosen from what
  // is being made, never from how many times it was asked for.
  let idOfTheNextMacro = 'macro-sem-id';
  const { logger, readRecordedLines } = createRecordingLogger();
  const store: StateStore = createStateStore({
    database,
    logger,
    graphicPackagesFolder: createGraphicsFolderWithTheRealGraphicsOfTheMacros(),
    readCurrentTime: readTheFakedWallClock,
    createItemId: () => {
      const itemIdsHeld = store.readAllSlices().items.map((item) => item.id);
      const nextItemId = itemIdsInCreationOrder.find((itemId) => !itemIdsHeld.includes(itemId));
      return nextItemId ?? 'item-sem-id';
    },
    createMacroId: () => idOfTheNextMacro,
    createTriggerId: () => `gatilho-${String(store.readAllSlices().triggers.length + 1)}`,
    createTriggerFiringId: () =>
      `disparo-${String(store.readAllSlices().triggerActivity.firings.length + 1)}`,
  });
  // The seeded "Patrocinadores a cada 30 min" and its macro (BAJAOVRLAY-64) are deleted
  // first, as an operator may: these tests make their own triggers and macros, numbered from
  // gatilho-1, and read their lists whole. seededPlainSponsorRoll.test.ts proves the seed.
  applyAsTheOperatorOrThrow(store, {
    type: 'deleteTrigger',
    triggerId: 'patrocinadores-a-cada-30-min',
  });
  applyAsTheOperatorOrThrow(store, { type: 'deleteMacro', macroId: 'patrocinadores-simples' });
  createTheItemsOfTheMacros(store);
  const stepsOfEachMacro = { ...buildDefaultMacroSteps(), ...options.macroSteps };
  for (const [macroId, label] of Object.entries(labelOfEachMacro)) {
    idOfTheNextMacro = macroId;
    applyAsTheOperatorOrThrow(store, {
      type: 'createMacro',
      label,
      color: 'info',
      steps: stepsOfEachMacro[macroId] ?? [],
    });
  }
  const macroRunner = startMacroRunner({ stateStore: store, logger });
  const triggerService = startTriggerService({
    stateStore: store,
    logger,
    readCurrentTime: readTheFakedWallClock,
  });
  onTestFinished(() => {
    triggerService.stop();
    macroRunner.stop();
  });
  if (options.isAutoOutRunning === true) {
    const autoOutScheduler = startAutoOutScheduler({ stateStore: store, logger });
    onTestFinished(() => autoOutScheduler.stop());
  }
  return {
    store,
    databasePath,
    passTime: (milliseconds) => {
      vi.advanceTimersByTime(milliseconds);
    },
    sleep: (milliseconds) => {
      vi.setSystemTime(Date.now() + milliseconds);
    },
    stepTheClockBack: (milliseconds) => {
      vi.setSystemTime(Date.now() - milliseconds);
    },
    readRecordedLogLines: readRecordedLines,
  };
}

/** Creates a trigger as the operator would on "Gatilhos" and returns its id. */
export function createTrigger(store: StateStore, trigger: Record<string, unknown>): string {
  const triggerCountBefore = store.readAllSlices().triggers.length;
  applyAsTheOperatorOrThrow(store, { type: 'createTrigger', ...trigger });
  const createdTrigger = store.readAllSlices().triggers[triggerCountBefore];
  expect(createdTrigger, 'the trigger must have been created').toBeDefined();
  return createdTrigger?.id ?? '';
}

/** OBS on the stream PC, connected, with four scenes and `programSceneName` on Program. */
export function buildObsShowing(programSceneName: string): ObsStatus {
  return {
    connectionState: 'conectado',
    address: 'ws://127.0.0.1:4455',
    lastError: null,
    sceneNames: ['Pista', 'Box', 'Pódio', 'Intervalo'],
    programSceneName,
    isStudioModeOn: false,
    previewSceneName: null,
  };
}

/** Reports, as the server's OBS connection does, that OBS now shows `programSceneName`. */
export function reportObsShowing(store: StateStore, programSceneName: string): void {
  store.applyCommand(
    { type: 'recordObsState', status: buildObsShowing(programSceneName) },
    obsConnectionActor,
  );
}

/** The firings in the list now, oldest first. */
export function readFirings(store: StateStore): TriggerFiring[] {
  return store.readAllSlices().triggerActivity.firings;
}

/** The macro running now, by id, or undefined when none is. */
export function readRunningMacroId(store: StateStore): string | undefined {
  return store.readAllSlices().macroRuns[0]?.macroId;
}

/** The data of what is on air on a layer's program output, or undefined when nothing is. */
export function readDataOnAirOnLayer(
  store: StateStore,
  layerId: string,
): Record<string, unknown> | undefined {
  const instance = store
    .readAllSlices()
    .instances.find((candidate) => candidate.layerId === layerId && candidate.target === 'program');
  return instance?.resolvedData;
}

/** The event log's rows as `actor command`, newest last, from the given command on. */
export function readEventLogFrom(store: StateStore, firstCommand: string): string[] {
  const eventLog = store.readAllSlices().eventLog;
  const positionOfTheFirst = eventLog.findIndex((entry) => entry.command === firstCommand);
  if (positionOfTheFirst === -1) {
    return [];
  }
  return eventLog.slice(positionOfTheFirst).map((entry) => `${entry.actor} ${entry.command}`);
}

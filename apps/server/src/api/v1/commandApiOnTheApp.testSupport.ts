// Test support: the server app with the command API turned on (BAJAOVRLAY-28), on a real
// store and a fresh SQLite file, its clock held and its ids counted, so two apps built
// alike stay alike command for command; a race day prepared on such a store; and a
// request as Companion sends it. Every call builds new objects; nothing is shared.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SliceName, Slices } from '@bajaovrlay/shared';

import { parseApiTokens } from '../../core/apiAccess/apiTokens.js';
import { writeSliceRows } from '../../core/db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../../core/db/temporaryDatabase.testSupport.js';
import { createServerApp } from '../../core/http/createServerApp.js';
import { createLogger, type ServerLogger } from '../../core/logger/createLogger.js';
import { operatorLoginOff } from '../../core/operatorLogin/operatorLoginOff.testSupport.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from '../../core/store/createStateStore.js';
import {
  createItemOnTheStore,
  createRaceClockItemOnTheStore,
  shortcutsPanelHome,
} from '../../core/store/raceClockItemOnTheStore.testSupport.js';
import { answerClientMessage } from '../../core/ws/clientMessageAnswers.js';

/** The operator connection the WebSocket twin of each request is sent as. */
export const operatorActor = 'operador:conexao-7';

/** The moment every command of these tests is stamped with: 10:15 in Brasília, race day. */
export const momentOfTheRaceDay = '2026-11-14T13:15:00.000Z';

/** The app, its store and the logger it writes to. */
export type AppWithTheCommandApi = {
  app: ReturnType<typeof createServerApp>;
  stateStore: StateStore;
};

/**
 * Builds the app as production does, with BAJAOVRLAY_API_TOKENS read from the given text
 * (undefined: the variable is not set), the race clock and a three-step podium built,
 * the clock held at momentOfTheRaceDay and every new id counted from 1, so two apps
 * built by this function give the same ids to the same commands.
 */
export function createAppWithTheCommandApi(options: {
  apiTokensVariable: string | undefined;
  /** BAJAOVRLAY_API_OPEN=true: the API answers calls with no token. Left out: not open. */
  isApiOpenToTheNetwork?: boolean;
  logger?: ServerLogger;
  /**
   * Slice rows written over the seeded ones before the store boots, as a damaged or an
   * older database would hold them (for example `rundowns` as an empty list).
   */
  rowsWrittenBeforeTheBoot?: Array<{ name: SliceName; json: unknown }>;
}): AppWithTheCommandApi {
  const parsing = parseApiTokens(options.apiTokensVariable);
  if (!parsing.isValid) {
    throw new Error(`The test's BAJAOVRLAY_API_TOKENS is refused: ${parsing.problem}`);
  }
  const logger = options.logger ?? createLogger({ level: 'silent' });
  const { database } = openTemporaryDatabase();
  const graphicPackagesFolder = createGraphicsFolderWithRaceClockAndPodium();
  if (options.rowsWrittenBeforeTheBoot !== undefined) {
    // A first boot seeds the database; the rows are then written as the test asks.
    createStateStore({ database, logger, graphicPackagesFolder });
    writeSliceRows(
      database,
      options.rowsWrittenBeforeTheBoot.map((row) => ({ ...row, updatedAt: momentOfTheRaceDay })),
    );
  }
  const stateStore = createStateStore({
    database,
    logger,
    graphicPackagesFolder,
    readCurrentTime: () => new Date(momentOfTheRaceDay),
    createInstanceId: countIdsFrom('instancia'),
    createItemId: countIdsFrom('item'),
    createMacroId: countIdsFrom('macro'),
    createQuickFirePanelId: countIdsFrom('painel'),
    createDataSourceId: countIdsFrom('fonte'),
    createEventId: countIdsFrom('evento'),
  });
  const app = createServerApp({
    operatorLogin: operatorLoginOff,
    logger,
    version: '0.3.1',
    stateStore,
    apiTokens: parsing.apiTokens,
    isApiOpenToTheNetwork: options.isApiOpenToTheNetwork ?? false,
  });
  return { app, stateStore };
}

/** Makes ids `<prefix>-1`, `<prefix>-2`, ... in the order they are asked for. */
function countIdsFrom(prefix: string): () => string {
  let lastNumber = 0;
  return () => {
    lastNumber += 1;
    return `${prefix}-${lastNumber}`;
  };
}

/**
 * A graphics folder with the built race clock and a built `podium` of three OGraf steps
 * (3rd, 2nd, then 1st place) on the fullscreen layer, so "Próximo" has a step to go to.
 */
function createGraphicsFolderWithRaceClockAndPodium(): string {
  const graphicsFolder = createGraphicsFolderWithBuiltRaceClock();
  const podiumDistFolder = join(graphicsFolder, 'podium', 'dist');
  mkdirSync(podiumDistFolder, { recursive: true });
  const podiumManifest = {
    $schema: 'https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json',
    id: 'baja-podium',
    name: 'Pódio',
    description: 'Os três primeiros, um por passo.',
    version: '0.1.0',
    main: 'podium.js',
    supportsRealTime: true,
    supportsNonRealTime: false,
    stepCount: 3,
    schema: {
      type: 'object',
      properties: { sessionName: { type: 'string', title: 'Título' } },
      required: ['sessionName'],
      additionalProperties: false,
    },
    v_baja: { defaultLayerId: 'fullscreen' },
  };
  writeFileSync(join(podiumDistFolder, 'podium.ograf.json'), JSON.stringify(podiumManifest));
  return graphicsFolder;
}

/** The ids of what prepareTheRaceDay put on the store. */
export type RaceDayOnTheStore = {
  /** "Relógio do enduro": clock layer, main session, under the cursor. */
  enduroClockItemId: string;
  /** "Relógio no canto": bug layer, a button of "Atalhos". */
  cornerClockItemId: string;
  /** "Pódio do enduro": fullscreen layer, three steps, a button of "Atalhos". */
  podiumItemId: string;
  /** "Abrir a sessão": one step, the take of the enduro clock. */
  openTheSessionMacroId: string;
};

/**
 * Prepares the race day on a store, as the operator would on the control page: two clock
 * items and the podium, the cursor on the enduro clock, and the macro "Abrir a sessão".
 * First the seeded "Logo do canal" button is deleted (BAJAOVRLAY-63; YouTube shows the
 * channel's own logo, so it goes unused here), so "Atalhos" holds the day's buttons alone,
 * numbered from 1. Throws when the store refuses a step, so a broken Arrange fails loudly.
 */
export function prepareTheRaceDay(stateStore: StateStore): RaceDayOnTheStore {
  applyOrThrow(stateStore, { type: 'deleteItem', itemId: 'logo-do-canal' });
  const enduroClockItemId = createRaceClockItemOnTheStore(stateStore);
  const cornerClockItemId = createRaceClockItemOnTheStore(stateStore, {
    label: 'Relógio no canto',
    layerId: 'bug',
    home: shortcutsPanelHome,
  });
  const podiumItemId = createItemOnTheStore(stateStore, {
    type: 'createItem',
    home: shortcutsPanelHome,
    graphicId: 'podium',
    layerId: 'fullscreen',
    label: 'Pódio do enduro',
    fields: { sessionName: { kind: 'literal', value: 'Enduro de Resistência' } },
  });
  applyOrThrow(stateStore, {
    type: 'moveCursor',
    rundownId: 'sessao-principal',
    itemId: enduroClockItemId,
  });
  applyOrThrow(stateStore, {
    type: 'createMacro',
    label: 'Abrir a sessão',
    color: 'success',
    steps: [{ kind: 'takeItem', itemId: enduroClockItemId }],
  });
  const openTheSessionMacroId = stateStore.readAllSlices().macros.at(-1)?.id ?? '';
  return { enduroClockItemId, cornerClockItemId, podiumItemId, openTheSessionMacroId };
}

/** Sends one command as the operator and throws when the store refuses it. */
export function applyOrThrow(stateStore: StateStore, command: Record<string, unknown>): void {
  const outcome = stateStore.applyCommand(command, operatorActor);
  if (!outcome.ok) {
    throw new Error(
      `The Arrange step ${String(command.type)} was refused: ${outcome.error.message}`,
    );
  }
}

/**
 * Sends one command as the control page does, over the WebSocket protocol (the same
 * handler the hub calls for each message), and returns the commandResult it answers.
 */
export function sendCommandOverTheWebSocket(stateStore: StateStore, command: unknown) {
  return answerClientMessage({
    messageText: JSON.stringify({ type: 'command', requestId: 'tomar-1', command }),
    stateStore,
    actor: operatorActor,
    logger: createLogger({ level: 'silent' }),
  });
}

/**
 * Sends one request to the app as Companion's generic HTTP module does. `token` puts
 * `Authorization: Bearer <token>`; `authorization` puts that header as written instead;
 * neither sends no header. A `body` is sent as JSON text. `clientAddress` is the address
 * the socket reports, given to the app as @hono/node-server gives Node's request.
 */
export async function sendApiRequest(
  app: AppWithTheCommandApi['app'],
  request: {
    method: 'GET' | 'POST';
    path: string;
    token?: string;
    authorization?: string;
    body?: unknown;
    clientAddress?: string;
  },
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (request.token !== undefined) {
    headers['Authorization'] = `Bearer ${request.token}`;
  }
  if (request.authorization !== undefined) {
    headers['Authorization'] = request.authorization;
  }
  let body: string | undefined;
  if (request.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(request.body);
  }
  const nodeServerBindings =
    request.clientAddress === undefined
      ? undefined
      : { incoming: { socket: { remoteAddress: request.clientAddress } } };
  return await app.request(
    `http://localhost${request.path}`,
    { method: request.method, headers, body },
    nodeServerBindings,
  );
}

/**
 * The event log as it reads when who sent each command does not count: the command, what
 * it carried and how it ended. Used to compare a request with its WebSocket twin.
 */
export function readEventLogWithoutActors(stateStore: StateStore) {
  return stateStore.readAllSlices().eventLog.map((entry) => ({
    ts: entry.ts,
    command: entry.command,
    payload: entry.payload,
    result: entry.result,
  }));
}

/** Every slice except the event log, which a request and its WebSocket twin sign differently. */
export function readSlicesExceptTheEventLog(stateStore: StateStore) {
  const otherSlices: Partial<Slices> = { ...stateStore.readAllSlices() };
  delete otherSlices.eventLog;
  return otherSlices;
}

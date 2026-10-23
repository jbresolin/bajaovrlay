// Test support: puts the real server of the Playwright run back to how a new database
// has it (nothing on air, nothing previewed, no layer marked "vai limpar", no item in the rundown or in any panel, no
// macro, only the seeded panel "Atalhos", only the seeded simulator, off and with its
// default settings, no correction of a source's value, and an empty entity library and
// media store), so every browser test starts from the same place whatever ran
// before it, in any order. playwright.config.ts starts that server.

import { portOffsetOfTheBrowserTests } from '../../../scripts/e2ePortOffset.js';

// BAJAOVRLAY_E2E_PORT_OFFSET moves every port of the browser tests by the same amount
// (scripts/e2ePortOffset.ts, the one place it is read); CI leaves it unset. Passed on for
// playwright.config.ts, which moves the control page's own port by it.
export { portOffsetOfTheBrowserTests };

/** The real server's port in a Playwright run; far from 3000 so it never meets `pnpm dev`. */
export const realServerPort = 5187 + portOffsetOfTheBrowserTests;

const realServerAddress = `http://127.0.0.1:${realServerPort}`;

// Long enough for a slow CI machine, short enough to fail with a clear message first.
const waitLimitInMilliseconds = 5000;

// The seeded quick-fire panel; it is kept (the server refuses to delete the last panel)
// and given back its seeded name if a test renamed it.
const seededPanelId = 'atalhos';
const seededPanelName = 'Atalhos';

// A macro can run for a while (each wait up to 10 s); this is how long the reset waits
// for one to end before giving up, and how often it looks.
const longestWaitForARunningMacroInMilliseconds = 30_000;
const timeBetweenLooksInMilliseconds = 100;

// The seeded data source, "Simulador — Enduro", as a new database has it: off, read every
// 2 s, and with the default config (an empty config is completed with the defaults by
// the server: speed 1, 60 cars, 4 h, "Falha simulada" off). Its race start is kept by the
// server on every edit, so its race carries on where it was; the reset cannot move it
// (restartSimulatedRace is refused while the source is off), so each data source test
// presses "Reiniciar corrida" after turning it on (João's ruling 3 at gate 2 of PR #16).
const seededSimulatorId = 'simulador-enduro';
/** The seeded source's label, as every new database has it (shared with the data source steps). */
export const seededSimulatorLabel = 'Simulador — Enduro';
const seededSimulatorPollIntervalMs = 2_000;
const emptyConfigTheServerCompletesWithDefaults = {};

/** The parts of GET /api/v1/state the reset reads. */
type StateTheResetReads = {
  items: { id: string }[];
  quickFirePanels: { id: string; name: string }[];
  macros: { id: string }[];
  macroRuns: { macroId: string }[];
  dataSources: { id: string; isEnabled: boolean; isRecording: boolean }[];
  overrides: { sourceId: string; scope: string; field: string; carNumber?: number }[];
  teams: { carNumber: number }[];
  people: { personId: string }[];
  sponsors: { sponsorId: string }[];
  scheduleSlots: { slotId: string }[];
  media: { mediaId: string }[];
};

/** A command the reset sends: its type and the one or two fields it carries. */
type ResetCommand = {
  type: string;
  itemId?: string;
  macroId?: string;
  panelId?: string;
  name?: string;
  sourceId?: string;
  isEnabled?: boolean;
  label?: string;
  pollIntervalMs?: number;
  config?: object;
  scope?: string;
  field?: string;
  carNumber?: number;
  entityType?: string;
  personId?: string;
  sponsorId?: string;
  slotId?: string;
  mediaId?: string;
};

/**
 * Sends one command to the real server over a WebSocket of its own, exactly as the
 * control page does, and resolves once the server has answered ok. Rejects when the
 * server refuses the command or does not answer within five seconds.
 */
function sendCommandToRealServer(command: ResetCommand): Promise<void> {
  const requestId = `pedido-${crypto.randomUUID()}`;
  const socket = new WebSocket(`ws://127.0.0.1:${realServerPort}/ws`);

  return new Promise((resolve, reject) => {
    const giveUpTimer = setTimeout(() => {
      socket.close();
      reject(new Error(`the real server did not answer the ${command.type} command`));
    }, waitLimitInMilliseconds);

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'command', requestId, command }));
    });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as {
        type: string;
        requestId?: string | null;
        ok?: boolean;
        error?: { code: string };
      };
      const isTheAnswerToThisCommand =
        message.type === 'commandResult' && message.requestId === requestId;
      if (!isTheAnswerToThisCommand) {
        return;
      }
      clearTimeout(giveUpTimer);
      socket.close();
      if (message.ok === true) {
        resolve();
      } else {
        const errorCode = message.error?.code ?? 'UNKNOWN';
        reject(new Error(`the real server refused the ${command.type} command: ${errorCode}`));
      }
    });
    socket.addEventListener('error', () => {
      clearTimeout(giveUpTimer);
      reject(new Error('could not connect to the real server; is it running on its e2e port?'));
    });
  });
}

/** Asks the real server for its state, as GET /api/v1/state answers it. */
async function readStateFromRealServer(): Promise<StateTheResetReads> {
  const response = await fetch(`${realServerAddress}/api/v1/state`);
  if (!response.ok) {
    throw new Error(`GET /api/v1/state answered ${response.status} on the real server`);
  }
  return (await response.json()) as StateTheResetReads;
}

/**
 * Waits until no macro is running. A macro left running by the test before would go on
 * taking and clearing in the middle of the next test, and the server refuses to delete a
 * running macro, so the reset waits for it to end (the server's runner always ends it).
 */
async function waitUntilNoMacroIsRunning(): Promise<void> {
  const giveUpAt = performance.now() + longestWaitForARunningMacroInMilliseconds;
  while (performance.now() < giveUpAt) {
    const state = await readStateFromRealServer();
    if (state.macroRuns.length === 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, timeBetweenLooksInMilliseconds));
  }
  throw new Error('a macro was still running on the real server after 30 seconds');
}

/**
 * Puts the data sources back to how a new database has them: every recording stopped
 * (so its file is closed and listed as ended), every source but the seeded simulator
 * deleted, and the seeded simulator off, with its seeded label, interval and default
 * config. A simulator left at speed 60 or failing on purpose would otherwise run on into
 * the next test. Its last data stays: no command deletes a snapshot. If a test deleted
 * the seeded simulator, nothing can bring it back short of a restart, so it is skipped.
 */
async function putTheDataSourcesBackToTheSeed(state: StateTheResetReads): Promise<void> {
  // A recording may stop by itself (a failed write) after the state was read; the server
  // accepts a stop of a source that is not recording as a no-op, so this cannot fail then.
  for (const source of state.dataSources) {
    if (source.isRecording) {
      await sendCommandToRealServer({ type: 'stopRecording', sourceId: source.id });
    }
  }
  for (const source of state.dataSources) {
    if (source.id !== seededSimulatorId) {
      await sendCommandToRealServer({ type: 'deleteDataSource', sourceId: source.id });
    }
  }
  const seededSimulator = state.dataSources.find((source) => source.id === seededSimulatorId);
  if (seededSimulator === undefined) {
    return;
  }
  if (seededSimulator.isEnabled) {
    await sendCommandToRealServer({
      type: 'setDataSourceEnabled',
      sourceId: seededSimulatorId,
      isEnabled: false,
    });
  }
  // Accepted with no change when the simulator already has these settings.
  await sendCommandToRealServer({
    type: 'updateDataSource',
    sourceId: seededSimulatorId,
    label: seededSimulatorLabel,
    pollIntervalMs: seededSimulatorPollIntervalMs,
    config: emptyConfigTheServerCompletesWithDefaults,
  });
}

/**
 * Empties the entity library and the media store: every team, person, sponsor and slot
 * deleted, then every image, which the server deletes only once no record names it.
 */
async function emptyTheEntityLibrary(): Promise<void> {
  const state = await readStateFromRealServer();
  for (const team of state.teams) {
    await sendCommandToRealServer({
      type: 'deleteEntity',
      entityType: 'team',
      carNumber: team.carNumber,
    });
  }
  for (const person of state.people) {
    await sendCommandToRealServer({
      type: 'deleteEntity',
      entityType: 'person',
      personId: person.personId,
    });
  }
  for (const sponsor of state.sponsors) {
    await sendCommandToRealServer({
      type: 'deleteEntity',
      entityType: 'sponsor',
      sponsorId: sponsor.sponsorId,
    });
  }
  for (const slot of state.scheduleSlots) {
    await sendCommandToRealServer({
      type: 'deleteEntity',
      entityType: 'scheduleSlot',
      slotId: slot.slotId,
    });
  }
  for (const image of state.media) {
    await sendCommandToRealServer({ type: 'deleteMedia', mediaId: image.mediaId });
  }
}

/**
 * Empties the real server. First it waits for a running macro to end. Then `clearAll`
 * takes everything off air and off the preview output (it removes every instance, of
 * both outputs, and every "vai limpar" mark, so no stopPreview is needed); every item is deleted, rundown and panel alike, which also leaves the
 * cursor on nothing; every macro is deleted; every panel but the seeded "Atalhos" is
 * deleted (each is empty by then), and "Atalhos" gets its seeded name back. The seeded
 * rundown stays. The data sources go back to the seeded simulator alone, off, not
 * recording and with its default settings (putTheDataSourcesBackToTheSeed); recordings
 * stay listed. Every correction of a source's value is removed (clearOverride), and the
 * entity library and its images are emptied. Each test file calls this in a
 * `test.beforeEach`, so a test never
 * depends on the one before it.
 * What could go wrong: it deletes whatever the server holds, so it must only ever be
 * pointed at the Playwright run's own server and SQLite file, which the port guarantees.
 */
export async function emptyTheServerState(): Promise<void> {
  await waitUntilNoMacroIsRunning();
  await sendCommandToRealServer({ type: 'clearAll' });
  const state = await readStateFromRealServer();
  for (const item of state.items) {
    await sendCommandToRealServer({ type: 'deleteItem', itemId: item.id });
  }
  for (const macro of state.macros) {
    await sendCommandToRealServer({ type: 'deleteMacro', macroId: macro.id });
  }
  for (const panel of state.quickFirePanels) {
    if (panel.id !== seededPanelId) {
      await sendCommandToRealServer({ type: 'deleteQuickFirePanel', panelId: panel.id });
    }
  }
  const seededPanel = state.quickFirePanels.find((panel) => panel.id === seededPanelId);
  if (seededPanel !== undefined && seededPanel.name !== seededPanelName) {
    await sendCommandToRealServer({
      type: 'renameQuickFirePanel',
      panelId: seededPanelId,
      name: seededPanelName,
    });
  }
  for (const override of state.overrides) {
    await sendCommandToRealServer({
      type: 'clearOverride',
      sourceId: override.sourceId,
      scope: override.scope,
      field: override.field,
      ...(override.carNumber === undefined ? {} : { carNumber: override.carNumber }),
    });
  }
  await putTheDataSourcesBackToTheSeed(state);
  await emptyTheEntityLibrary();
}

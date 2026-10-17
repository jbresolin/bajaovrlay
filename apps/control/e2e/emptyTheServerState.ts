// Test support: puts the real server of the Playwright run back to how a new database
// has it (nothing on air, nothing previewed, no layer marked "vai limpar", no item in the rundown or in any panel, no
// macro, only the seeded panel "Atalhos"), so every browser test starts from the same
// place whatever ran before it, in any order. playwright.config.ts starts that server.

/** The real server's port in a Playwright run; far from 3000 so it never meets `pnpm dev`. */
export const realServerPort = 5187;

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

/** The parts of GET /api/v1/state the reset reads. */
type StateTheResetReads = {
  items: { id: string }[];
  quickFirePanels: { id: string; name: string }[];
  macros: { id: string }[];
  macroRuns: { macroId: string }[];
};

/** A command the reset sends: its type and the one or two fields it carries. */
type ResetCommand = {
  type: string;
  itemId?: string;
  macroId?: string;
  panelId?: string;
  name?: string;
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
 * Empties the real server. First it waits for a running macro to end. Then `clearAll`
 * takes everything off air and off the preview output (it removes every instance, of
 * both outputs, and every "vai limpar" mark, so no stopPreview is needed); every item is deleted, rundown and panel alike, which also leaves the
 * cursor on nothing; every macro is deleted; every panel but the seeded "Atalhos" is
 * deleted (each is empty by then), and "Atalhos" gets its seeded name back. The seeded
 * rundown stays. Each test file calls this in a `test.beforeEach`, so a test never
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
}

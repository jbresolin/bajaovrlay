// Test support: puts the real server of the Playwright run back to how a new database
// has it (nothing on air, no item in the rundown), so every browser test starts from the
// same place whatever ran before it, in any order. playwright.config.ts starts that server.

/** The real server's port in a Playwright run; far from 3000 so it never meets `pnpm dev`. */
export const realServerPort = 5187;

const realServerAddress = `http://127.0.0.1:${realServerPort}`;

// Long enough for a slow CI machine, short enough to fail with a clear message first.
const waitLimitInMilliseconds = 5000;

/**
 * Sends one command to the real server over a WebSocket of its own, exactly as the
 * control page does, and resolves once the server has answered ok. Rejects when the
 * server refuses the command or does not answer within five seconds.
 */
function sendCommandToRealServer(command: { type: string; itemId?: string }): Promise<void> {
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

/** Asks the real server which items its rundowns hold, and answers with their ids. */
async function readItemIdsFromRealServer(): Promise<string[]> {
  const response = await fetch(`${realServerAddress}/api/v1/state`);
  const state = (await response.json()) as { items: { id: string }[] };
  return state.items.map((item) => item.id);
}

/**
 * Empties the real server: `clearAll` takes everything off air, then every item is
 * deleted, which also leaves the cursor on nothing. The seeded rundown stays. Each test
 * file calls this in a `test.beforeEach`, so a test never depends on the one before it.
 * What could go wrong: it deletes whatever the server holds, so it must only ever be
 * pointed at the Playwright run's own server and SQLite file, which the port guarantees.
 */
export async function emptyTheServerState(): Promise<void> {
  await sendCommandToRealServer({ type: 'clearAll' });
  const itemIds = await readItemIdsFromRealServer();
  for (const itemId of itemIds) {
    await sendCommandToRealServer({ type: 'deleteItem', itemId });
  }
}

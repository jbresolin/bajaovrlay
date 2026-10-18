// Test support: where the real BajaOvrLay server of the Playwright run listens, and how a
// test sends it a command over its WebSocket, exactly as the control page will.
// playwright.config.ts starts that server (with its own SQLite file) before the tests.

/** The real server's port in a Playwright run; far from 3000 so it never meets `pnpm dev`. */
export const realServerPort = 5185;

/** The port of the renderer's Vite dev server in a Playwright run; it proxies to the one above. */
export const rendererPagePort = 5184;

/** The SQLite file of the Playwright run's server, from the repository root (gitignored). */
export const realServerDatabasePath = 'apps/renderer/.e2e-data/renderer-e2e.sqlite';

/** The data folder (DATA_DIR) of the Playwright run's server, next to its database (gitignored). */
export const realServerDataFolder = 'apps/renderer/.e2e-data';

// Long enough for a slow CI machine, short enough to fail with a clear message first.
const waitLimitInMilliseconds = 5000;

/**
 * What the server answered to a command: ok, or the error's stable code. The ok of an
 * accepted createItem also names the item the server made (`createdItemId`), so a test
 * can take that very item next.
 */
export type CommandAnswer = { ok: true; createdItemId?: string } | { ok: false; errorCode: string };

/**
 * Sends one command to the real server over a WebSocket of its own and resolves with the
 * server's commandResult. Rejects if no answer comes within five seconds.
 */
export function sendCommandToRealServer(command: Record<string, unknown>): Promise<CommandAnswer> {
  const requestId = `pedido-${crypto.randomUUID()}`;
  const socket = new WebSocket(`ws://127.0.0.1:${realServerPort}/ws`);

  return new Promise((resolve, reject) => {
    const giveUpTimer = setTimeout(() => {
      socket.close();
      reject(new Error(`the real server did not answer the ${String(command.type)} command`));
    }, waitLimitInMilliseconds);

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'command', requestId, command }));
    });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as {
        type: string;
        requestId?: string | null;
        ok?: boolean;
        createdItemId?: string;
        error?: { code: string };
      };
      const isTheAnswerToThisCommand =
        message.type === 'commandResult' && message.requestId === requestId;
      if (!isTheAnswerToThisCommand) {
        return;
      }
      clearTimeout(giveUpTimer);
      socket.close();
      if (message.ok === true && message.createdItemId !== undefined) {
        resolve({ ok: true, createdItemId: message.createdItemId });
      } else if (message.ok === true) {
        resolve({ ok: true });
      } else {
        resolve({ ok: false, errorCode: message.error?.code ?? 'UNKNOWN' });
      }
    });
    socket.addEventListener('error', () => {
      clearTimeout(giveUpTimer);
      reject(new Error('could not connect to the real server; is it running on its e2e port?'));
    });
  });
}

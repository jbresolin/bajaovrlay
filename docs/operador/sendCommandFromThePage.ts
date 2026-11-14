// Test support (operator guide pictures, BAJAOVRLAY-31): a command sent the way the console
// sends it, over a WebSocket opened from inside the logged-in page. Why from the page: the
// pictures' server has the operator login on, and only a page carrying the Produtor's session
// cookie may command it; a WebSocket opened from Node would carry no session and be refused.
// Used for the setup the pictures do not show (the simulator's speed, a typed penalty).
import type { Page } from '@playwright/test';

// Long enough for a slow machine, short enough to fail with a clear message first.
const waitForTheAnswerInMilliseconds = 5000;

/** The parts of the server's answer this helper reads. */
type CommandAnswer = { isOk: boolean; errorCode: string };

/**
 * Sends one command from inside the page, as the logged-in operator, and resolves once the
 * server has accepted it. Throws, naming the command and the server's code, when refused or
 * when no answer comes in time.
 */
export async function sendCommandFromThePage(
  page: Page,
  command: { type: string } & Record<string, unknown>,
): Promise<void> {
  const answer = await page.evaluate(
    async ({ commandToSend, waitInMilliseconds }): Promise<CommandAnswer> => {
      const webSocketAddress = `${location.origin.replace(/^http/, 'ws')}/ws`;
      const socket = new WebSocket(webSocketAddress);
      const requestId = `pedido-${crypto.randomUUID()}`;
      return new Promise((resolve) => {
        const giveUpTimer = setTimeout(() => {
          socket.close();
          resolve({ isOk: false, errorCode: 'NO_ANSWER_IN_TIME' });
        }, waitInMilliseconds);
        socket.addEventListener('open', () => {
          socket.send(JSON.stringify({ type: 'command', requestId, command: commandToSend }));
        });
        socket.addEventListener('message', (event) => {
          const message = JSON.parse(String(event.data)) as {
            type: string;
            requestId?: string;
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
          resolve({ isOk: message.ok === true, errorCode: message.error?.code ?? '' });
        });
      });
    },
    { commandToSend: command, waitInMilliseconds: waitForTheAnswerInMilliseconds },
  );
  if (!answer.isOk) {
    throw new Error(`the guide's server refused ${command.type}: ${answer.errorCode}`);
  }
}

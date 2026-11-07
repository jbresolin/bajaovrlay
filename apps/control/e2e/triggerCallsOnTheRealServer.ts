// Test support for the triggers' browser test (BAJAOVRLAY-48): the API token the
// Playwright run's server is started with, and a call to an HTTP trigger's address as a
// D200 through Companion sends it. Functions and constants only; nothing is remembered.
import { realServerPort } from './emptyTheServerState';

/**
 * The token the run's server lists in BAJAOVRLAY_API_TOKENS (../playwright.config.ts), as
 * `e2e=<token>`: the trigger's address has the command API's access, so a call needs it.
 * A made-up value for a throwaway server, never a real one.
 */
export const apiTokenOfTheBrowserTests = 'token-dos-testes-de-navegador-48';

/** BAJAOVRLAY_API_TOKENS as the run's server reads it. */
export const apiTokensVariableOfTheBrowserTests = `e2e=${apiTokenOfTheBrowserTests}`;

/**
 * Calls POST /api/v1/triggers/<triggerId> on the run's server with the token and the body
 * as JSON text, and resolves with the HTTP status the server answered.
 */
export async function callTheHttpTrigger(triggerId: string, body: object): Promise<number> {
  const response = await fetch(
    `http://127.0.0.1:${String(realServerPort)}/api/v1/triggers/${triggerId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiTokenOfTheBrowserTests}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  return response.status;
}

import {
  type LoginRequest,
  type SessionAnswer,
  SessionAnswerSchema,
} from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

/** The address of the session on the page's own server (BAJAOVRLAY-29). */
const sessionAddress = '/api/v1/session';

/** What a login came to: in, or the sentence to show (the server's, or ours when unreachable). */
export type LoginAttemptOutcome = { isLoggedIn: true } | { isLoggedIn: false; message: string };

/**
 * Asks the server whether it wants a login and who this page is (GET /api/v1/session).
 * The cookie goes with it by itself (same origin). Undefined when the server cannot be
 * reached or answers something unreadable; main.tsx then opens the page as before and
 * lets the WebSocket's own reconnecting say the server is away.
 */
export async function readSessionAnswerFromTheServer(): Promise<SessionAnswer | undefined> {
  try {
    const response = await fetch(sessionAddress);
    if (!response.ok) {
      return undefined;
    }
    return SessionAnswerSchema.parse(await response.json());
  } catch {
    return undefined;
  }
}

/**
 * Sends the login (POST /api/v1/session). The server answers with the session cookie,
 * which the browser keeps by itself; a refusal carries its pt-BR sentence (wrong PIN, the
 * wait after five). Never throws.
 */
export async function sendLoginToTheServer(login: LoginRequest): Promise<LoginAttemptOutcome> {
  try {
    const response = await fetch(sessionAddress, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(login),
    });
    if (response.ok) {
      return { isLoggedIn: true };
    }
    const body = (await response.json()) as { error?: { message?: string } };
    return {
      isLoggedIn: false,
      message: body.error?.message ?? ptBR.login.problems.serverUnreachable,
    };
  } catch {
    return { isLoggedIn: false, message: ptBR.login.problems.serverUnreachable };
  }
}

/** "Sair" (DELETE /api/v1/session): ends the session on the server. Never throws. */
export async function sendLogoutToTheServer(): Promise<void> {
  try {
    await fetch(sessionAddress, { method: 'DELETE' });
  } catch {
    // Deliberate: the page goes to "#/entrar" all the same; the session ends by itself.
  }
}

/**
 * Opens the login page in this tab, from scratch: the address becomes "#/entrar" and the
 * page reloads, so no connection, store or draft of the session that ended is kept.
 */
export function goToTheLoginPage(): void {
  window.location.hash = '#/entrar';
  window.location.reload();
}

/** Opens the console in this tab, from scratch, after a login: "#/" and a reload. */
export function goToTheConsoleAfterTheLogin(): void {
  window.location.hash = '#/';
  window.location.reload();
}

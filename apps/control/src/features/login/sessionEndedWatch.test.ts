/**
 * Going back to the login when the session ends (apps/control)
 *
 * What this module is for:
 *   The server closes a logged-in page's WebSocket when its session ends: "Sair" on
 *   another tab, or its 18 hours over (BAJAOVRLAY-29). The page cannot read why from the
 *   close itself, so after every drop it asks GET /api/v1/session: with the login on and
 *   no session left, it goes to "#/entrar"; otherwise it keeps redialling as before (a
 *   server restart keeps the session).
 *
 * What these tests prove:
 *   - The login on and no session: the page goes to the login.
 *   - A session still there (a restart), the login off, or no answer (the server is down):
 *     the page stays and keeps redialling.
 *
 * What these tests deliberately do not cover:
 *   - The redialling itself; state/serverConnectionRedialling.test.ts.
 */
import type { SessionAnswer } from '@bajaovrlay/shared';
import { describe, expect, it, vi } from 'vitest';

import { goToTheLoginWhenTheSessionEnded } from './sessionEndedWatch';

const scenarios: Array<{
  name: string;
  answer: SessionAnswer | undefined;
  isSentToTheLogin: boolean;
}> = [
  // "Sair" on another tab, or the 18 hours over.
  {
    name: 'goes to the login when the server asks for one and the session is gone',
    answer: { isLoginRequired: true, session: null },
    isSentToTheLogin: true,
  },
  // A server restart: the session is still there, the line comes back by itself.
  {
    name: 'stays when the session is still there',
    answer: {
      isLoginRequired: true,
      session: { role: 'dados', station: 'Mesa 2', expiresAt: '2026-11-08T05:00:00.000Z' },
    },
    isSentToTheLogin: false,
  },
  // A server with no PINs.
  {
    name: 'stays when the server asks for no login',
    answer: { isLoginRequired: false, session: null },
    isSentToTheLogin: false,
  },
  // The server is down: no answer at all.
  { name: 'stays when the server does not answer', answer: undefined, isSentToTheLogin: false },
];

describe('goToTheLoginWhenTheSessionEnded', () => {
  it.each(scenarios)('$name', async ({ answer, isSentToTheLogin }) => {
    // Arrange: the server's answer of the row, and a stand-in for the move to the login.
    const goToTheLoginPage = vi.fn();

    // Act: the line dropped; ask about the session.
    await goToTheLoginWhenTheSessionEnded({
      readSessionAnswer: () => Promise.resolve(answer),
      goToTheLoginPage,
    });

    // Assert: to the login only when the session is gone.
    expect(goToTheLoginPage.mock.calls.length, 'whether the page went to the login').toBe(
      isSentToTheLogin ? 1 : 0,
    );
  });
});

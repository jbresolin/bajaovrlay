import type { SessionAnswer } from '@bajaovrlay/shared';

/**
 * After the WebSocket dropped: asks the server about the session and goes to "#/entrar"
 * when it wants a login and this page no longer has a session ("Sair" on another tab, or
 * the 18 hours over, BAJAOVRLAY-29). A restart keeps the session and a server that does
 * not answer says nothing, so in both the page stays and keeps redialling. The two
 * stand-ins are the real requests in main.tsx.
 */
export async function goToTheLoginWhenTheSessionEnded(options: {
  readSessionAnswer: () => Promise<SessionAnswer | undefined>;
  goToTheLoginPage: () => void;
}): Promise<void> {
  const answer = await options.readSessionAnswer();
  const isSessionGone = answer?.isLoginRequired === true && answer.session === null;
  if (isSessionGone) {
    options.goToTheLoginPage();
  }
}

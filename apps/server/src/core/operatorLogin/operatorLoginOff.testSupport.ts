// Test support: a login with no PINs and no database behind it, for tests of other things
// that build the app or the WebSocket hub by hand. The app and the hub require a login
// (gate 2 of PR #51), so a test that does not care hands this one over, in plain sight.
import type { OperatorLogin } from './operatorLogin.js';

/** The login off: every page read open, a login answered as with no PINs. */
export const operatorLoginOff: OperatorLogin = {
  isLoginRequired: false,
  logIn: () => ({ kind: 'loginTurnedOff' }),
  findSessionOfCookieHeader: () => undefined,
  logOut: () => undefined,
  subscribeToEndedSessions: () => () => undefined,
};

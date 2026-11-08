// Why this is NOT server state (CLAUDE.md, architecture rule 1): the station's name is a
// fact about this computer, typed once at its first login, not about the show. The server
// keeps it in the session for the event log; the browser only keeps it to fill in the
// login form next time (BAJAOVRLAY-29). Losing it costs typing "Mesa 1" again.
const nameOfTheStoredStation = 'bajaovrlay.estacao';

/**
 * The station this browser logged in from last time, or an empty text when none is kept,
 * or when the browser refuses its storage (a private window, blocked site data).
 */
export function readRememberedStation(): string {
  try {
    return window.localStorage.getItem(nameOfTheStoredStation) ?? '';
  } catch {
    return '';
  }
}

/** Keeps the station for the next login; a browser that refuses its storage keeps nothing. */
export function rememberStation(station: string): void {
  try {
    window.localStorage.setItem(nameOfTheStoredStation, station);
  } catch {
    // Deliberate: a browser without storage is not an error the operator can act on.
  }
}

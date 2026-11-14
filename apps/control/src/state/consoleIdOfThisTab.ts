/**
 * Where a tab keeps its console id (BAJAOVRLAY-69): read before each connection, to name it
 * in the address, and written when a hello names one. main.tsx hands in the browser tab's
 * sessionStorage (consoleIdMemoryOfTheBrowserTab); tests hand in a plain stand-in.
 */
export type ConsoleIdMemory = {
  readConsoleId: () => string | null;
  keepConsoleId: (consoleId: string) => void;
};

// One key for the tab. The "Programa" and "Prévia" frames share this sessionStorage but are
// screens (they connect with `role=monitor`), so they never read or write it.
const consoleIdStorageKey = 'bajaovrlay.consoleId';

/**
 * The browser tab's sessionStorage as the console id's memory: a reload of the tab keeps
 * it, a new tab starts without it, which is exactly "one tab, one console".
 * Merely reading window.sessionStorage throws when site data is blocked, so both functions
 * catch. What could go wrong then: the tab is handed a new console id at each connection,
 * so after a reconnect its own take of 2 s before counts as another console's, and its next
 * take there, made before the page heard of it, would be refused once.
 */
export const consoleIdMemoryOfTheBrowserTab: ConsoleIdMemory = {
  readConsoleId: () => {
    try {
      return window.sessionStorage.getItem(consoleIdStorageKey);
    } catch {
      return null;
    }
  },
  keepConsoleId: (consoleId) => {
    try {
      window.sessionStorage.setItem(consoleIdStorageKey, consoleId);
    } catch {
      // Nothing to do: see "What could go wrong" above.
    }
  },
};

/**
 * The WebSocket address with the tab's console id named in it (`?console=<id>`), or the
 * address as it was when the tab has none yet (its first connection).
 */
export function addConsoleIdToWebSocketAddress(
  webSocketAddress: string,
  consoleId: string | null,
): string {
  if (consoleId === null) {
    return webSocketAddress;
  }
  const addressWithTheConsole = new URL(webSocketAddress);
  addressWithTheConsole.searchParams.set('console', consoleId);
  return addressWithTheConsole.toString();
}

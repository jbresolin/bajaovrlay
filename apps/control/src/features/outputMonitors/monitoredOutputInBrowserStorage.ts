// Why this is NOT server state, like "Prévia automática" (features/autoPreview): which
// output a monitor shows is a habit of the person at this screen, not a fact about the
// show. Two operators may each watch a different output, nothing on air depends on it,
// and losing it costs one click. So it lives in this browser's localStorage, one entry per
// monitor (BAJAOVRLAY-49).
import type { MonitoredOutput } from './OutputMonitor';

/** The storage entry of one monitor ("Programa" or "Prévia"). */
function nameOfTheStoredChoice(monitored: MonitoredOutput): string {
  return `bajaovrlay.saidaDoMonitor.${monitored}`;
}

/**
 * The output this browser last chose for a monitor, or null when it chose none or refuses
 * its storage (a private window): the monitor then shows program.
 */
export function readOutputOfMonitorFromBrowserStorage(monitored: MonitoredOutput): string | null {
  try {
    return window.localStorage.getItem(nameOfTheStoredChoice(monitored));
  } catch {
    return null;
  }
}

/**
 * Keeps the choice for the next time the page opens. A browser that refuses its storage
 * keeps nothing, and nothing is said: the picker still works until the page is closed.
 */
export function writeOutputOfMonitorToBrowserStorage(
  monitored: MonitoredOutput,
  outputId: string,
): void {
  try {
    window.localStorage.setItem(nameOfTheStoredChoice(monitored), outputId);
  } catch {
    // Deliberate: a browser without storage is not an error the operator can act on.
  }
}

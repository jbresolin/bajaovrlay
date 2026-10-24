// Why this is NOT server state (CLAUDE.md, architecture rule 1, and the brief of
// BAJAOVRLAY-44, which allows it as the one convenience): whether this browser chimes on a
// new event is a habit of the person at this keyboard, not a fact about the show. A second
// operator's laptop may want silence; nothing on air depends on it.
const nameOfTheStoredSetting = 'bajaovrlay.somDeEventos';
const textStoredWhenOn = 'ligado';
const textStoredWhenOff = 'desligado';

/**
 * Reads whether "Som de eventos" is on in this browser. On is the default: only the text
 * this page itself stores for "off" switches it off. A browser that refuses its storage
 * reads as the default too.
 */
export function readIsEventSoundOnFromBrowserStorage(): boolean {
  try {
    return window.localStorage.getItem(nameOfTheStoredSetting) !== textStoredWhenOff;
  } catch {
    return true;
  }
}

/** Stores the operator's choice in this browser; a browser that refuses stores nothing. */
export function writeIsEventSoundOnToBrowserStorage(isEventSoundOn: boolean): void {
  try {
    window.localStorage.setItem(
      nameOfTheStoredSetting,
      isEventSoundOn ? textStoredWhenOn : textStoredWhenOff,
    );
  } catch {
    // Deliberate: a browser without storage is not an error the operator can act on.
  }
}

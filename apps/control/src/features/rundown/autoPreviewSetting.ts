import { useState } from 'react';

// Why this is NOT server state, the one exception on this page (CLAUDE.md, architecture
// rule 1): whether moving the cursor also previews is a habit of the person at this
// keyboard, not a fact about the show. Two operators on the same server may each want it
// their own way, nothing on air or in the rundown depends on it, and losing it costs one
// click. So it lives in this browser's localStorage and nowhere else.
const nameOfTheStoredSetting = 'bajaovrlay.previaAutomatica';
const textStoredWhenOn = 'ligada';
const textStoredWhenOff = 'desligada';

/**
 * Reads whether "Prévia automática" is on in this browser. On is the default: only the
 * text this page itself stores for "off" switches it off. A browser that refuses its
 * storage (a private window, blocked site data) throws from localStorage; the page must
 * work without it, so that reads as the default too.
 */
export function readIsAutoPreviewOnFromBrowserStorage(): boolean {
  try {
    return window.localStorage.getItem(nameOfTheStoredSetting) !== textStoredWhenOff;
  } catch {
    return true;
  }
}

/**
 * Stores the operator's choice in this browser, for the next time the page opens. When
 * the browser refuses, nothing is stored and nothing is said: the switch still works
 * until the page is closed, and starts on again next time.
 */
export function writeIsAutoPreviewOnToBrowserStorage(isAutoPreviewOn: boolean): void {
  try {
    window.localStorage.setItem(
      nameOfTheStoredSetting,
      isAutoPreviewOn ? textStoredWhenOn : textStoredWhenOff,
    );
  } catch {
    // Deliberate: a browser without storage is not an error the operator can act on.
  }
}

/**
 * "Prévia automática" for the page that is open: whether it is on, and the function the
 * switch calls. The stored choice is read once, when the page opens; a change is kept
 * in the page and stored at the same time. What could go wrong: another tab of the same
 * browser does not follow the change until it is reloaded.
 */
export function useAutoPreviewSetting(): {
  isAutoPreviewOn: boolean;
  chooseIsAutoPreviewOn: (isAutoPreviewOn: boolean) => void;
} {
  const [isAutoPreviewOn, setIsAutoPreviewOn] = useState(readIsAutoPreviewOnFromBrowserStorage);

  function chooseIsAutoPreviewOn(isOnNow: boolean): void {
    setIsAutoPreviewOn(isOnNow);
    writeIsAutoPreviewOnToBrowserStorage(isOnNow);
  }

  return { isAutoPreviewOn, chooseIsAutoPreviewOn };
}

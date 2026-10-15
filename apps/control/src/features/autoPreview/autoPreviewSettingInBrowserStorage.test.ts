/**
 * Remembering "Prévia automática" in the browser (apps/control)
 *
 * What this module is for:
 *   The switch "Prévia automática" is a matter of taste of the person at this keyboard,
 *   so it is remembered in this browser's own storage (localStorage) and not on the
 *   server. A browser may refuse that storage altogether (private windows, blocked site
 *   data, a full disk). The page must then work exactly as if nothing had ever been
 *   stored: the switch starts on, and still works until the page is closed.
 *
 * What these tests prove:
 *   - Reading: with nothing stored the answer is "on" (the default); the text the page
 *     itself stores for "off" gives "off"; the text for "on", and any text the page never
 *     wrote, give "on".
 *   - Writing then reading gives back what was written, for on and for off.
 *   - When the browser's storage throws, reading answers "on" and writing does nothing,
 *     and neither lets the error out.
 *
 * What these tests deliberately do not cover:
 *   - The page's one store that reads and writes through these functions:
 *     autoPreviewSettingStore.test.ts.
 *   - The switch on the page and what it does to the arrow keys: RundownPanelPreview.test.tsx.
 *   - Two tabs of the same browser: a tab reads the storage once, when it opens, and does
 *     not follow a change made in another tab.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  readIsAutoPreviewOnFromBrowserStorage,
  writeIsAutoPreviewOnToBrowserStorage,
} from './autoPreviewSettingInBrowserStorage';

// The name the setting is stored under, written out here on purpose: if it changes,
// every operator's stored choice is lost, and this test is where that gets noticed.
const nameOfTheStoredSetting = 'bajaovrlay.previaAutomatica';

/** Makes every read and write of the browser's storage fail, as a browser that blocks it does. */
function makeBrowserStorageRefuseEverything() {
  const refuse = () => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  };
  const refusedRead = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse);
  const refusedWrite = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse);
  return {
    /** Gives the browser a working storage again, for the tests that follow. */
    letBrowserStorageWorkAgain: () => {
      refusedRead.mockRestore();
      refusedWrite.mockRestore();
    },
  };
}

describe('reading "Prévia automática" from the browser', () => {
  const storedTextScenarios: Array<{
    name: string;
    storedText: string | null;
    expectedIsOn: boolean;
  }> = [
    // A browser that never saw the page: the brief's default is on.
    { name: 'is on when nothing was ever stored', storedText: null, expectedIsOn: true },
    // What the page stores when the operator switches it off.
    { name: 'is off when "desligada" is stored', storedText: 'desligada', expectedIsOn: false },
    // What the page stores when the operator switches it back on.
    { name: 'is on when "ligada" is stored', storedText: 'ligada', expectedIsOn: true },
    // Text the page never wrote (an older version, a hand edit): fall back to the
    // default rather than guess.
    { name: 'is on when some other text is stored', storedText: 'talvez', expectedIsOn: true },
  ];

  it.each(storedTextScenarios)('$name', ({ storedText, expectedIsOn }) => {
    // Arrange: the browser's storage holds what this row says, or nothing at all.
    if (storedText !== null) {
      window.localStorage.setItem(nameOfTheStoredSetting, storedText);
    }

    // Act: read the setting, as the page does when it opens.
    const isOn = readIsAutoPreviewOnFromBrowserStorage();

    // Assert: on or off as this row says.
    expect(isOn, 'only the stored text "desligada" may switch auto-preview off').toBe(expectedIsOn);
  });
});

describe('writing "Prévia automática" to the browser', () => {
  const choicesToRemember = [
    // The operator switches it off: the next page load must find it off.
    { name: 'remembers that it was switched off', isOn: false },
    // And back on.
    { name: 'remembers that it was switched on', isOn: true },
  ];

  it.each(choicesToRemember)('$name', ({ isOn }) => {
    // Arrange: a browser that holds the opposite choice.
    writeIsAutoPreviewOnToBrowserStorage(!isOn);

    // Act: store the choice, then read it as a newly opened page would.
    writeIsAutoPreviewOnToBrowserStorage(isOn);
    const isOnWhenReadAgain = readIsAutoPreviewOnFromBrowserStorage();

    // Assert: the choice came back.
    expect(isOnWhenReadAgain, 'a stored choice must be the one read back').toBe(isOn);
  });
});

describe('a browser that refuses to store anything', () => {
  it('reads as "on", the default, instead of failing', () => {
    // Arrange: the storage throws on every read and write.
    const browserStorage = makeBrowserStorageRefuseEverything();

    // Act: read the setting.
    const isOn = readIsAutoPreviewOnFromBrowserStorage();
    browserStorage.letBrowserStorageWorkAgain();

    // Assert: the default, and no error got out (the line above would have thrown).
    expect(isOn, 'without storage the setting must be the default: on').toBe(true);
  });

  it('does nothing, and does not fail, when asked to store a choice', () => {
    // Arrange: the storage throws on every read and write.
    const browserStorage = makeBrowserStorageRefuseEverything();

    // Act: store "off", as a click on the switch does.
    const storeTheChoice = () => writeIsAutoPreviewOnToBrowserStorage(false);

    // Assert: no error gets out, and afterwards nothing was stored.
    expect(storeTheChoice, 'a refused write must never break the page').not.toThrow();
    browserStorage.letBrowserStorageWorkAgain();
    expect(
      window.localStorage.getItem(nameOfTheStoredSetting),
      'a refused write stores nothing',
    ).toBeNull();
  });
});

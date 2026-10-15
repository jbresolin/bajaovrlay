/**
 * The page's one store for "Prévia automática" (apps/control)
 *
 * What this module is for:
 *   "Prévia automática" decides whether the item the rundown's cursor arrives on is also
 *   previewed. It is read in two areas of the page: the rundown column (its switch, the
 *   arrows, Space, "Disparar") and the lines under the "Prévia" monitor ("Tomar"). So the
 *   page keeps it in one store of its own, built once when the page opens, and both areas
 *   read and change that same store. It is the one thing on the page that is not server
 *   state: it is remembered in this browser's localStorage, read once when the store is
 *   built and written on every change.
 *
 * What these tests prove:
 *   - A new store is on when nothing was stored, and off when "off" was stored.
 *   - A change is kept in the store at once and stored in the browser, so a store built
 *     later (the page opened again) starts as it was left.
 *   - When the browser's storage throws on read the store starts on; when it throws on
 *     write the change still holds in the store and no error gets out.
 *
 * What these tests deliberately do not cover:
 *   - Which texts are stored and how odd ones read: autoPreviewSettingInBrowserStorage.test.ts.
 *   - The switch on the page and what it changes for the arrows and the takes:
 *     RundownPanelPreview.test.tsx, RundownPanelPreviewAfterTake.test.tsx and
 *     PreviewedLayersListPreviewAfterTake.test.tsx.
 *   - Two tabs of the same browser: each builds its store once and does not follow the other.
 */
import { describe, expect, it, vi } from 'vitest';

import { createAutoPreviewSettingStore } from './autoPreviewSettingStore';

// The name the setting is stored under, written out here on purpose: if it changes,
// every operator's stored choice is lost, and this test is where that gets noticed.
const nameOfTheStoredSetting = 'bajaovrlay.previaAutomatica';

/** Makes the browser's storage throw on every read, as a browser that blocks it does. */
function makeBrowserStorageRefuseToRead() {
  return vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  });
}

/** Makes the browser's storage throw on every write, as a full or blocked storage does. */
function makeBrowserStorageRefuseToWrite() {
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  });
}

describe('a new "Prévia automática" store', () => {
  it('is on when this browser never stored a choice', () => {
    // Arrange: a browser that never saw the page (the test setup empties the storage).

    // Act: build the store, as the page does when it opens.
    const autoPreviewSettingStore = createAutoPreviewSettingStore();

    // Assert: on, the brief's default.
    expect(
      autoPreviewSettingStore.getState().isAutoPreviewOn,
      'with nothing stored "Prévia automática" must start on',
    ).toBe(true);
  });

  it('is off when this browser stored "off"', () => {
    // Arrange: the operator switched it off on an earlier day.
    window.localStorage.setItem(nameOfTheStoredSetting, 'desligada');

    // Act: build the store.
    const autoPreviewSettingStore = createAutoPreviewSettingStore();

    // Assert: off, as it was left.
    expect(
      autoPreviewSettingStore.getState().isAutoPreviewOn,
      'a stored "off" must be what a newly opened page starts with',
    ).toBe(false);
  });

  it('is on when the browser refuses to read its storage', () => {
    // Arrange: a browser whose storage throws on every read.
    const refusedRead = makeBrowserStorageRefuseToRead();

    // Act: build the store.
    const autoPreviewSettingStore = createAutoPreviewSettingStore();
    refusedRead.mockRestore();

    // Assert: the default, and the store was built (the line above would have thrown).
    expect(
      autoPreviewSettingStore.getState().isAutoPreviewOn,
      'a browser without storage must start with the default: on',
    ).toBe(true);
  });
});

describe('changing "Prévia automática"', () => {
  it('holds at once in the store and is found by a store built later', () => {
    // Arrange: a page that opened with the default (on).
    const autoPreviewSettingStore = createAutoPreviewSettingStore();

    // Act: the operator switches it off; later the page is opened again.
    autoPreviewSettingStore.getState().chooseIsAutoPreviewOn(false);
    const storeOfThePageOpenedLater = createAutoPreviewSettingStore();

    // Assert: off in the page that changed it, and off in the page opened later.
    expect(
      autoPreviewSettingStore.getState().isAutoPreviewOn,
      'a change must hold in the store at once',
    ).toBe(false);
    expect(
      storeOfThePageOpenedLater.getState().isAutoPreviewOn,
      'a change must be stored, so the page opened later starts as it was left',
    ).toBe(false);
  });

  it('still holds in the store, and does not fail, when the browser refuses to store it', () => {
    // Arrange: a page that opened with the default, in a browser that refuses to write.
    const autoPreviewSettingStore = createAutoPreviewSettingStore();
    const refusedWrite = makeBrowserStorageRefuseToWrite();

    // Act: the operator switches it off.
    const switchItOff = () => autoPreviewSettingStore.getState().chooseIsAutoPreviewOn(false);

    // Assert: no error gets out, the page follows the choice, and nothing was stored.
    expect(switchItOff, 'a refused write must never break the page').not.toThrow();
    refusedWrite.mockRestore();
    expect(
      autoPreviewSettingStore.getState().isAutoPreviewOn,
      'the switch must still work for this page when nothing can be stored',
    ).toBe(false);
    expect(
      window.localStorage.getItem(nameOfTheStoredSetting),
      'a refused write stores nothing',
    ).toBeNull();
  });
});

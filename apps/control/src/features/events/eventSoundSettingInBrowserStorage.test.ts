/**
 * "Som de eventos" in this browser's storage (apps/control)
 *
 * What this module is for:
 *   Whether this browser chimes on a new pending event is the operator's own habit, kept
 *   in localStorage (BAJAOVRLAY-44). A browser may refuse its storage (a private window,
 *   blocked site data); the page must work anyway, with the sound on.
 *
 * What these tests prove:
 *   - With nothing stored the sound is on; "off" is read back as off.
 *   - A storage whose getItem throws reads as on, and a setItem that throws is ignored.
 *
 * What these tests deliberately do not cover:
 *   - The switch and the chime; EventsTabAlert.test.tsx.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  readIsEventSoundOnFromBrowserStorage,
  writeIsEventSoundOnToBrowserStorage,
} from './eventSoundSettingInBrowserStorage';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('the stored "Som de eventos"', () => {
  it('is on with nothing stored, and off once switched off', () => {
    // Arrange: an empty storage.
    const isOnAtFirst = readIsEventSoundOnFromBrowserStorage();

    // Act: switch it off.
    writeIsEventSoundOnToBrowserStorage(false);

    // Assert: on by default, off once stored so.
    expect(isOnAtFirst, 'the sound is on by default').toBe(true);
    expect(readIsEventSoundOnFromBrowserStorage(), 'the choice is read back').toBe(false);
  });

  it('reads as on, and stores nothing, in a browser that refuses its storage', () => {
    // Arrange: a storage that throws on every read and write.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('O armazenamento do navegador está bloqueado.');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('O armazenamento do navegador está bloqueado.');
    });

    // Act: write, then read.
    writeIsEventSoundOnToBrowserStorage(false);
    const isOn = readIsEventSoundOnFromBrowserStorage();

    // Assert: on, and nothing thrown.
    expect(isOn, 'a refused storage reads as the default').toBe(true);
  });
});

// Test support: the browser's crypto as a page opened over plain http on the LAN has it,
// with getRandomValues and no randomUUID (browsers offer randomUUID only on https or
// localhost). Undone at the end of the test.
import { onTestFinished, vi } from 'vitest';

/** Replaces globalThis.crypto with one that has no randomUUID, until the test ends. */
export function takeRandomUUIDAwayAsOnPlainHttp(): void {
  const realCrypto = globalThis.crypto;
  vi.stubGlobal('crypto', {
    getRandomValues: (values: Uint8Array<ArrayBuffer>) => realCrypto.getRandomValues(values),
  });
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
}

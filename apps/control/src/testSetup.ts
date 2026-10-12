// Runs before every control-page test file (see vitest.config.ts).
// Adds DOM matchers such as `toBeInTheDocument()` to `expect`.
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Testing Library only removes rendered pages automatically when Vitest globals are on.
// They are off in this repository, so each test's page is removed here; otherwise the
// next test would find two pages and two buttons.
afterEach(() => {
  cleanup();
  // A test that moved time by hand (`vi.useFakeTimers()`) must not leave the next test
  // with a clock that stands still.
  vi.useRealTimers();
  // A test that switched "Prévia automática" off (the one thing the page keeps in the
  // browser's own storage) must not leave the next test with it off.
  window.localStorage.clear();
});

// The tests run in jsdom, a browser stand-in that draws nothing and so lacks the three
// layout features below. The shadcn/ui tooltip and dropdown call them when they open.
// These stand-ins do nothing, which is right for a page that has no layout at all.
class ResizeObserverThatNeverReports {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverThatNeverReports;
Element.prototype.scrollIntoView ??= () => undefined;
Element.prototype.hasPointerCapture ??= () => false;

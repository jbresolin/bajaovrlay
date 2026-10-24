// Runs before every server test file. The server's test files share their worker's
// modules (isolate: false in vitest.config.ts), so anything a test changes on the
// worker itself would reach the next file. Environment variables and globals are put back
// by the config (unstubEnvs, unstubGlobals); the two left are put back here.
import { afterEach, vi } from 'vitest';

afterEach(() => {
  // A test that fakes the clock restores it at its end, but a test that fails first never
  // reaches that line: the next file would then run on a fake clock and fail for no
  // reason of its own.
  vi.useRealTimers();
  // A spy on a shared object (console, a module's export) would otherwise stay in place
  // for every later file of the worker.
  vi.restoreAllMocks();
});

// Test support: the fake OBS 32 of openFakeObs.testSupport.ts, for Vitest tests: every
// call builds its own server and its own scenes, closed for good when the test ends.
import { onTestFinished } from 'vitest';

import type { FakeObs, FakeObsSetup } from './fakeObsControls.testSupport.js';
import { openFakeObs } from './openFakeObs.testSupport.js';

export type { FakeObs, FakeObsSetup } from './fakeObsControls.testSupport.js';

/**
 * Starts a fake OBS with the given setup on a free port; it is closed for good when the
 * test ends.
 */
export async function startFakeObs(setup: FakeObsSetup): Promise<FakeObs> {
  const fakeObs = await openFakeObs(setup);
  onTestFinished(fakeObs.closeForGood);
  return fakeObs;
}

// `node scripts/checkPortOffset.js`: the first thing `pnpm verify` and `pnpm test:chaos`
// run (BAJAOVRLAY-72). Exits 1 with one line when BAJAOVRLAY_E2E_PORT_OFFSET would move a
// browser test's port onto one Windows holds: 5357 (the WSD service) always, and the
// ranges Windows has excluded when netsh.exe can be read (WSL). Silent when the offset
// works. The judging is in portOffsetSafety.js; this file only gathers what it judges.
import { spawnSync } from 'node:child_process';

import { browserTestPorts } from './browserTestPorts.js';
import {
  describeWhyThePortOffsetCannotWork,
  portOfWindowsWsdService,
  readExcludedPortRangesOfWindows,
  readPortOffsetTheBrowserTestsWillUse,
} from './portOffsetSafety.js';

/**
 * The port ranges Windows has excluded, read through netsh.exe, or none where it cannot
 * be run (Linux proper, CI, a WSL without Windows' PATH): the check then covers 5357 only,
 * quietly, as the brief asks.
 * @returns {import('./portOffsetSafety.js').BlockedPorts[]}
 */
function readExcludedPortRangesOfThisMachine() {
  // 10 s: netsh answers in about half a second; a hung one must not hold the run back.
  const netsh = spawnSync(
    'netsh.exe',
    ['interface', 'ipv4', 'show', 'excludedportrange', 'protocol=tcp'],
    { encoding: 'utf8', timeout: 10_000 },
  );
  const couldNetshBeRead = netsh.error === undefined && netsh.status === 0;
  if (!couldNetshBeRead) {
    return [];
  }
  return readExcludedPortRangesOfWindows(netsh.stdout);
}

const offset = readPortOffsetTheBrowserTestsWillUse(process.env.BAJAOVRLAY_E2E_PORT_OFFSET);
// The WSD port first, so a port netsh also lists as excluded is credited to WSD.
const blockedPortsList = [portOfWindowsWsdService, ...readExcludedPortRangesOfThisMachine()];
const reason = describeWhyThePortOffsetCannotWork(offset, browserTestPorts, blockedPortsList);
if (reason !== null) {
  process.stderr.write(`${reason}\n`);
  process.exitCode = 1;
}

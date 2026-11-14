/**
 * Port offsets that cannot work (scripts)
 *
 * What this module is for:
 *   BAJAOVRLAY_E2E_PORT_OFFSET moves every port of the browser tests by one amount, so two
 *   worktrees can run them at once. Some amounts can never work on João's machine: on
 *   2026-11-12 BAJAOVRLAY-76's `pnpm verify` failed twice with offset 140, because the
 *   intermission board's preview port 5217 moved onto 5357, the port Windows' WSD service
 *   holds (busy through WSL). Windows also keeps ranges of ports excluded (Hyper-V), which
 *   `netsh.exe interface ipv4 show excludedportrange protocol=tcp` lists. `pnpm verify` and
 *   `pnpm test:chaos` now ask this module first, and refuse such an offset in one line that
 *   names the port and the nearest offsets that work.
 *
 * What these tests prove:
 *   - Offset 140 is refused with the intermission board's port named, and 139 and 141
 *     offered; 0 (CI) and 190 (the offset -76 moved to) are accepted.
 *   - A range Windows has excluded refuses an offset the same way, naming the range.
 *   - An offset that moves any port past 65535, the highest port there is, is refused
 *     with that port named; the largest offset that keeps every port at 65535 or under
 *     is accepted.
 *   - netsh's table is read in English and in Portuguese, and output with no table (a
 *     failed or different command) gives no ranges rather than an error.
 *   - The offset is read exactly as the browser tests read it (scripts/e2ePortOffset.ts).
 *
 * What these tests deliberately do not cover:
 *   - Running netsh.exe itself (checkPortOffset.js): it exists only on WSL.
 *   - Whether the port list matches the configs: browserTestPorts.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { readPortOffsetOfTheBrowserTests } from './e2ePortOffset.js';
import {
  describeWhyThePortOffsetCannotWork,
  findNearestSafePortOffsets,
  findPortsTheOffsetMovesOntoBlockedPorts,
  portOfWindowsWsdService,
  readExcludedPortRangesOfWindows,
  readPortOffsetTheBrowserTestsWillUse,
} from './portOffsetSafety.js';

// A few real ports of scripts/browserTestPorts.js, enough for every case below.
const someBrowserTestPorts = [
  { port: 5176, file: 'packages/graphics/race-clock/playwright.config.ts' },
  { port: 5188, file: 'apps/control/playwright.config.ts' },
  { port: 5217, file: 'packages/graphics/intermission-board/playwright.config.ts' },
  { port: 5233, file: 'apps/control/e2e/chaos/steps/chaosPorts.ts' },
];

// Only the WSD port, as on any machine where netsh.exe cannot be read.
const onlyTheWsdPort = [portOfWindowsWsdService];

// What netsh.exe printed on João's machine on 2026-11-12 (line ends as Windows writes them).
const netshOutputInEnglish = [
  '',
  'Protocol tcp Port Exclusion Ranges',
  '',
  'Start Port    End Port      ',
  '----------    --------      ',
  '      5357        5357      ',
  '     11021       11021      ',
  '     50000       50059     *',
  '',
  '* - Administered port exclusions.',
  '',
].join('\r\n');

describe('describeWhyThePortOffsetCannotWork', () => {
  it('refuses offset 140, which put the intermission board on 5357 for BAJAOVRLAY-76', () => {
    // Arrange: the offset -76 used, and only the WSD port blocked.
    const offset = 140;

    // Act: ask why it cannot work.
    const reason = describeWhyThePortOffsetCannotWork(offset, someBrowserTestPorts, onlyTheWsdPort);

    // Assert: one line naming the port, where it is written, the WSD service and the way out.
    expect(
      reason,
      'the refusal names the port, its file, what holds 5357 and two safe offsets',
    ).toBe(
      'BAJAOVRLAY_E2E_PORT_OFFSET=140 cannot work: it moves port 5217 ' +
        '(packages/graphics/intermission-board/playwright.config.ts) to 5357, ' +
        "held by Windows' WSD service. Nearest offsets that work: 139 and 141.",
    );
  });

  const acceptedOffsets = [
    // CI, and any run that leaves the variable unset.
    { name: 'accepts offset 0', offset: 0 },
    // The offset -76 moved to after its two failed runs.
    { name: 'accepts offset 190', offset: 190 },
    // 5357 - 5188 = 169 would hit, 170 moves the control page to 5358.
    { name: 'accepts offset 170, one past the control page hitting 5357', offset: 170 },
    // The largest offset that still fits: the chaos suite's output proxy (5233) lands on
    // 65535, the highest port there is.
    { name: 'accepts offset 60302, which puts the highest port on 65535', offset: 60302 },
  ];

  it.each(acceptedOffsets)('$name', ({ offset }) => {
    // Arrange: the offset of this row, with only the WSD port blocked.

    // Act: ask why it cannot work.
    const reason = describeWhyThePortOffsetCannotWork(offset, someBrowserTestPorts, onlyTheWsdPort);

    // Assert: there is no reason; the offset works.
    expect(reason, 'an offset that moves no port onto 5357 is accepted').toBeNull();
  });

  it('refuses an offset that moves a port past 65535, the highest port there is', () => {
    // Arrange: offset 60310 moves the chaos suite's output proxy (5233) to 65543, past
    // the last port; the intermission board (5217) lands on 65527 and still fits.
    const offset = 60310;

    // Act: ask why it cannot work.
    const reason = describeWhyThePortOffsetCannotWork(offset, someBrowserTestPorts, onlyTheWsdPort);

    // Assert: only the output proxy is named, and the one offset offered is the largest
    // that fits; none above it can work.
    expect(reason, 'the refusal names the port that leaves the port range').toBe(
      'BAJAOVRLAY_E2E_PORT_OFFSET=60310 cannot work: it moves port 5233 ' +
        '(apps/control/e2e/chaos/steps/chaosPorts.ts) to 65543, ' +
        'past 65535, the highest port there is. Nearest offsets that work: 60302.',
    );
  });

  it('refuses an offset that moves a port into a range Windows has excluded', () => {
    // Arrange: Windows has excluded 5300–5340; offset 100 moves the control page (5188)
    // to 5288, outside it, but the intermission board (5217) to 5317 and the chaos suite's
    // output proxy (5233) to 5333, inside it.
    const excludedRange = {
      firstPort: 5300,
      lastPort: 5340,
      heldBy: "Windows' excluded range 5300–5340",
    };
    const offset = 100;

    // Act: ask why it cannot work.
    const reason = describeWhyThePortOffsetCannotWork(offset, someBrowserTestPorts, [
      portOfWindowsWsdService,
      excludedRange,
    ]);

    // Assert: both ports named with the range. The offsets offered step over the whole
    // range: under 67 the output proxy stays below 5300, from 165 the race clock (5176)
    // lands above 5340 and no port lands on 5357.
    expect(reason, 'both ports inside the range are named, with the range').toBe(
      'BAJAOVRLAY_E2E_PORT_OFFSET=100 cannot work: it moves port 5217 ' +
        '(packages/graphics/intermission-board/playwright.config.ts) to 5317, ' +
        "held by Windows' excluded range 5300–5340; it moves port 5233 " +
        '(apps/control/e2e/chaos/steps/chaosPorts.ts) to 5333, ' +
        "held by Windows' excluded range 5300–5340. Nearest offsets that work: 66 and 165.",
    );
  });
});

describe('findPortsTheOffsetMovesOntoBlockedPorts', () => {
  it('names a port only once when two blocked ranges hold it', () => {
    // Arrange: netsh also lists 5357 itself, as it did on João's machine.
    const blockedPorts = [
      portOfWindowsWsdService,
      { firstPort: 5357, lastPort: 5357, heldBy: "Windows' excluded range 5357–5357" },
    ];

    // Act: look for ports offset 140 moves onto them.
    const clashes = findPortsTheOffsetMovesOntoBlockedPorts(
      140,
      someBrowserTestPorts,
      blockedPorts,
    );

    // Assert: the intermission board once, with the first range that holds it.
    expect(clashes, 'one clash, credited to the WSD service').toEqual([
      {
        port: 5217,
        file: 'packages/graphics/intermission-board/playwright.config.ts',
        movedPort: 5357,
        blockedPorts: portOfWindowsWsdService,
      },
    ]);
  });
});

describe('findNearestSafePortOffsets', () => {
  it('finds none below when every smaller offset is blocked too', () => {
    // Arrange: a range that blocks the race clock (5176) at offsets 0 to 2.
    const blockedPorts = [
      { firstPort: 5176, lastPort: 5178, heldBy: "Windows' excluded range 5176–5178" },
    ];

    // Act: look for the nearest safe offsets around 1.
    const nearest = findNearestSafePortOffsets(1, someBrowserTestPorts, blockedPorts);

    // Assert: nothing below, 3 above.
    expect(nearest, 'no safe offset under 1; 3 is the first above').toEqual({
      below: null,
      above: 3,
    });
  });
});

describe('readExcludedPortRangesOfWindows', () => {
  const outputs = [
    // João's machine, Windows in English.
    {
      name: 'reads the ranges of the English table',
      output: netshOutputInEnglish,
      expectedRanges: [
        { firstPort: 5357, lastPort: 5357 },
        { firstPort: 11021, lastPort: 11021 },
        { firstPort: 50000, lastPort: 50059 },
      ],
    },
    // A Windows in Portuguese words its headers differently; the numbers read the same.
    {
      name: 'reads the ranges of a table with Portuguese headers',
      output: [
        'Intervalos de Exclusão de Porta do Protocolo tcp',
        '',
        'Porta Inicial    Porta Final',
        '-------------    -----------',
        '      5357        5357',
        '     50000       50059     *',
        '',
        '* - Exclusões de porta administradas.',
      ].join('\r\n'),
      expectedRanges: [
        { firstPort: 5357, lastPort: 5357 },
        { firstPort: 50000, lastPort: 50059 },
      ],
    },
    // netsh failed or printed something else: no ranges, never an error.
    {
      name: 'reads no ranges from output with no table',
      output: 'The following command was not found: interface ipv4 show excludedportrange.',
      expectedRanges: [],
    },
  ];

  it.each(outputs)('$name', ({ output, expectedRanges }) => {
    // Arrange: netsh's output of this row.

    // Act: read the ranges out of it.
    const ranges = readExcludedPortRangesOfWindows(output);

    // Assert: the row's ranges, each named as Windows' excluded range with its ports.
    const expected = expectedRanges.map((range) => ({
      ...range,
      heldBy: `Windows' excluded range ${String(range.firstPort)}–${String(range.lastPort)}`,
    }));
    expect(ranges, 'every range of the table, and nothing else').toEqual(expected);
  });
});

describe('readPortOffsetTheBrowserTestsWillUse', () => {
  // The rows of e2ePortOffset.test.ts: the check must read every value as the tests do.
  const values = [undefined, '100', '0', 'cem', '-100', '1.5', '', '100px', '140'];

  it.each(values)('reads %j as the browser tests do', (value) => {
    // Arrange: the variable's value of this row.

    // Act: read it as the check does and as the browser tests do.
    const offsetOfTheCheck = readPortOffsetTheBrowserTestsWillUse(value);
    const offsetOfTheTests = readPortOffsetOfTheBrowserTests(value);

    // Assert: the same offset, so the check judges the ports the tests will open.
    expect(offsetOfTheCheck, 'the check and the browser tests read the same offset').toBe(
      offsetOfTheTests,
    );
  });
});

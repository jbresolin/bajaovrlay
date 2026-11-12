// Which values of BAJAOVRLAY_E2E_PORT_OFFSET cannot work on this machine, and why, in one
// line (BAJAOVRLAY-72). Pure functions: the ports come from browserTestPorts.js, the
// blocked ports from the caller (checkPortOffset.js adds Windows' excluded ranges, read
// through netsh.exe). Tested by portOffsetSafety.test.ts.

/**
 * @typedef {{ port: number, file: string }} BrowserTestPort
 * @typedef {{ firstPort: number, lastPort: number, heldBy: string }} BlockedPorts
 * @typedef {{ port: number, file: string, movedPort: number, blockedPorts: BlockedPorts }} PortClash
 */

// The same rule as scripts/e2ePortOffset.ts, which the browser tests read. That file is
// TypeScript, which plain Node scripts cannot import, so the rule is written twice and
// portOffsetSafety.test.ts runs both over the same values: a drift fails there.
const wholeNumberPattern = /^[0-9]+$/;

// How far away from the offset asked the nearest safe ones are looked for. Every port of
// the browser tests is in 5176–5233, so 1000 either way steps over any excluded range of
// that size; past it the line says none was found.
const farthestOffsetToTry = 1000;

/**
 * Port 5357 on Windows belongs to the WSD service (Web Services on Devices), so through
 * WSL it is busy even though no Linux process holds it. Checked on every machine: on Linux
 * proper it only refuses offsets that would also fail on João's machine.
 * @type {BlockedPorts}
 */
export const portOfWindowsWsdService = {
  firstPort: 5357,
  lastPort: 5357,
  heldBy: "Windows' WSD service",
};

/**
 * The offset a value of the variable gives, exactly as the browser tests read it: a whole
 * number as written, and 0 for unset or anything else.
 * @param {string | undefined} value
 * @returns {number}
 */
export function readPortOffsetTheBrowserTestsWillUse(value) {
  if (value === undefined || !wholeNumberPattern.test(value)) {
    return 0;
  }
  return Number(value);
}

/**
 * The ranges in the table `netsh.exe interface ipv4 show excludedportrange protocol=tcp`
 * prints. Only lines holding two numbers are read, so the headers' language does not
 * matter, and output with no table gives no ranges.
 * @param {string} netshOutput
 * @returns {BlockedPorts[]}
 */
export function readExcludedPortRangesOfWindows(netshOutput) {
  // A row: start port, end port, and a "*" after them when an administrator added it.
  const rowPattern = /^\s*(\d+)\s+(\d+)\s*\*?\s*$/;
  /** @type {BlockedPorts[]} */
  const ranges = [];
  for (const line of netshOutput.split(/\r?\n/)) {
    const row = rowPattern.exec(line);
    if (row === null) {
      continue;
    }
    const firstPort = Number(row[1]);
    const lastPort = Number(row[2]);
    ranges.push({
      firstPort,
      lastPort,
      heldBy: `Windows' excluded range ${String(firstPort)}–${String(lastPort)}`,
    });
  }
  return ranges;
}

/**
 * Every port of the browser tests that the offset moves onto a blocked port, each once,
 * with the first blocked range that holds it (the WSD port is passed first).
 * @param {number} offset
 * @param {BrowserTestPort[]} browserTestPorts
 * @param {BlockedPorts[]} blockedPortsList
 * @returns {PortClash[]}
 */
export function findPortsTheOffsetMovesOntoBlockedPorts(
  offset,
  browserTestPorts,
  blockedPortsList,
) {
  /** @type {PortClash[]} */
  const clashes = [];
  for (const { port, file } of browserTestPorts) {
    const movedPort = port + offset;
    const blockedPorts = blockedPortsList.find(
      (range) => movedPort >= range.firstPort && movedPort <= range.lastPort,
    );
    if (blockedPorts !== undefined) {
      clashes.push({ port, file, movedPort, blockedPorts });
    }
  }
  return clashes;
}

/**
 * The nearest offsets under and over the one asked that move no port onto a blocked one,
 * or null on a side where none is found (under 0, or more than 1000 away).
 * @param {number} offset
 * @param {BrowserTestPort[]} browserTestPorts
 * @param {BlockedPorts[]} blockedPortsList
 * @returns {{ below: number | null, above: number | null }}
 */
export function findNearestSafePortOffsets(offset, browserTestPorts, blockedPortsList) {
  /** @param {number} candidate */
  const isSafe = (candidate) =>
    findPortsTheOffsetMovesOntoBlockedPorts(candidate, browserTestPorts, blockedPortsList)
      .length === 0;

  let below = null;
  const lowestToTry = Math.max(0, offset - farthestOffsetToTry);
  for (let candidate = offset - 1; candidate >= lowestToTry; candidate -= 1) {
    if (isSafe(candidate)) {
      below = candidate;
      break;
    }
  }

  let above = null;
  for (let candidate = offset + 1; candidate <= offset + farthestOffsetToTry; candidate += 1) {
    if (isSafe(candidate)) {
      above = candidate;
      break;
    }
  }

  return { below, above };
}

/**
 * Null when the offset works; otherwise one line naming every port it moves onto a
 * blocked one, the file that writes that port, what holds it, and the nearest offsets
 * that work.
 * @param {number} offset
 * @param {BrowserTestPort[]} browserTestPorts
 * @param {BlockedPorts[]} blockedPortsList
 * @returns {string | null}
 */
export function describeWhyThePortOffsetCannotWork(offset, browserTestPorts, blockedPortsList) {
  const clashes = findPortsTheOffsetMovesOntoBlockedPorts(
    offset,
    browserTestPorts,
    blockedPortsList,
  );
  if (clashes.length === 0) {
    return null;
  }

  const clashSentences = clashes.map(
    (clash) =>
      `it moves port ${String(clash.port)} (${clash.file}) to ${String(clash.movedPort)}, ` +
      `held by ${clash.blockedPorts.heldBy}`,
  );
  const nearest = findNearestSafePortOffsets(offset, browserTestPorts, blockedPortsList);
  const safeOffsets = [nearest.below, nearest.above].filter((candidate) => candidate !== null);
  const wayOut =
    safeOffsets.length === 0
      ? `No offset within ${String(farthestOffsetToTry)} of it works.`
      : `Nearest offsets that work: ${safeOffsets.map(String).join(' and ')}.`;

  return (
    `BAJAOVRLAY_E2E_PORT_OFFSET=${String(offset)} cannot work: ` +
    `${clashSentences.join('; ')}. ${wayOut}`
  );
}

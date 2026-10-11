/**
 * Program renderer or program monitor: what the page's own address decides (apps/renderer)
 *
 * What this module is for:
 *   The same renderer page is loaded in two places. OBS loads `/render/` and puts it on
 *   the stream: that is the program output, and it tells the server what really went on
 *   air. The control page frames `/render/?monitor=1` so the operator can watch the same
 *   picture: that is a monitor, and it must stay silent, because only the program output
 *   is the truth (gate-2 ruling on BAJAOVRLAY-12). rendererPageRole reads the query of the
 *   page's address and answers which of the two this page is, and which WebSocket path it
 *   must dial: `/ws?role=renderer` for the program output, plain `/ws` for a monitor.
 *
 * What these tests prove:
 *   - `monitor=1` in the address, alone or among other parameters, makes the page a
 *     monitor that dials `/ws` with no role.
 *   - Every other address (no query, `monitor=0`, `monitor` with no value or another
 *     value, a different parameter) is the program renderer and dials `/ws?role=renderer`.
 *
 * What these tests deliberately do not cover:
 *   - That a monitor really sends nothing; src/instancePlayer.noReporter.test.ts proves
 *     the player part and e2e/programMonitor.e2e.ts proves it with the real page.
 *   - What the server does with a connection that has no role; the server's own tests.
 */
import { describe, expect, it } from 'vitest';

import { decideRendererPageRole } from './rendererPageRole.js';

const programMonitor = { isProgramMonitor: true, webSocketPath: '/ws' };
const programRenderer = { isProgramMonitor: false, webSocketPath: '/ws?role=renderer' };

const pageAddressScenarios = [
  // What OBS loads: http://192.168.0.10:3000/render/ with no query at all.
  {
    name: 'is the program renderer when the address has no query',
    pageAddressSearch: '',
    expectedRole: programRenderer,
  },
  // What the control page frames: /render/?monitor=1.
  {
    name: 'is a monitor when the address says monitor=1',
    pageAddressSearch: '?monitor=1',
    expectedRole: programMonitor,
  },
  // A cache-busting parameter in front must not turn a monitor into a second "OBS".
  {
    name: 'is a monitor when monitor=1 comes after another parameter',
    pageAddressSearch: '?recarregado=1728650000&monitor=1',
    expectedRole: programMonitor,
  },
  // Someone switching the monitor off by hand in the address means a normal renderer.
  {
    name: 'is the program renderer when the address says monitor=0',
    pageAddressSearch: '?monitor=0',
    expectedRole: programRenderer,
  },
  // Only the exact value 1 counts, so a half-typed address is never silently a monitor.
  {
    name: 'is the program renderer when monitor has no value',
    pageAddressSearch: '?monitor',
    expectedRole: programRenderer,
  },
  // Same rule: `true` is not the agreed value, and OBS with this address must still report.
  {
    name: 'is the program renderer when monitor has a value other than 1',
    pageAddressSearch: '?monitor=true',
    expectedRole: programRenderer,
  },
  // A parameter that merely contains the word must not be mistaken for the switch.
  {
    name: 'is the program renderer when only a different parameter is present',
    pageAddressSearch: '?monitorDeAudio=1',
    expectedRole: programRenderer,
  },
];

describe('decideRendererPageRole', () => {
  it.each(pageAddressScenarios)('$name', ({ pageAddressSearch, expectedRole }) => {
    // Arrange: the query part of the page's address is the one of the row.

    // Act: ask which role a page at that address has.
    const role = decideRendererPageRole(pageAddressSearch);

    // Assert: the role and the WebSocket path are the ones the row expects.
    expect(
      role,
      'only monitor=1 makes a monitor on plain /ws; anything else reports as the renderer',
    ).toEqual(expectedRole);
  });
});

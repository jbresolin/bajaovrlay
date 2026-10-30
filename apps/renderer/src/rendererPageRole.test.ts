/**
 * Program renderer, program monitor or preview page: what the page's own address decides
 * (apps/renderer)
 *
 * What this module is for:
 *   The same renderer page is loaded in three places. OBS loads `/render/` and puts it on
 *   the stream: that is the program output, and it tells the server what really went on
 *   air. The control page frames `/render/?monitor=1` so the operator can watch the same
 *   picture: that is a monitor, and it must stay silent, because only the program output
 *   is the truth (gate-2 ruling on BAJAOVRLAY-12). The control page also frames
 *   `/render/?target=preview&monitor=1`, which draws the screen as it will look after the
 *   take (the `preview` output over what stays on air), and is just as silent. rendererPageRole
 *   reads the query of the page's address and answers four things: which output this
 *   page draws, whether it reports to the server, which WebSocket path it must dial
 *   (`/ws?role=renderer` for the one page that reports, `/ws?role=monitor` for the
 *   others), and which address it reads the state from when its hello is late
 *   (`/api/v1/state` with the same role, so the server leaves out the race data and the
 *   event log the page never reads).
 *
 * What these tests prove:
 *   - `monitor=1` in the address, alone or among other parameters, makes the page a
 *     monitor of the program output that dials `/ws?role=monitor`, reads
 *     `/api/v1/state?role=monitor` and does not report.
 *   - `target=preview`, alone, with `monitor=1` in either order or among other parameters,
 *     makes the page draw the preview output, dial `/ws?role=monitor`, read
 *     `/api/v1/state?role=monitor` and not report.
 *   - Every other address (no query, `monitor=0`, `monitor` with no value or another
 *     value, `target=program`, `target=PREVIEW`, `target` with no value, a different
 *     parameter) is the program renderer: it draws program, reports, dials
 *     `/ws?role=renderer` and reads `/api/v1/state?role=renderer`.
 *   - `output=pip` (BAJAOVRLAY-49) names the output the page draws and is passed on to the
 *     server in both paths, so the server sends it the PiP's layers only; it combines with
 *     `target` and `monitor` as they combine with each other. No `output`, or an empty
 *     one, is program, and the paths are exactly those of a page from before outputs.
 *
 * What these tests deliberately do not cover:
 *   - That a monitor or a preview page really sends nothing;
 *     src/instancePlayer.noReporter.test.ts proves the player part, and
 *     e2e/programMonitor.e2e.ts and e2e/previewPage.e2e.ts prove it with the real page.
 *   - Which instances a page that draws the preview output shows;
 *     src/previewComposition.test.ts and src/instanceReconciler.preview.test.ts.
 *   - What the server does with each role; the server's own tests (core/ws and
 *     api/v1/stateRoute.test.ts).
 */
import { describe, expect, it } from 'vitest';

import { decideRendererPageRole } from './rendererPageRole.js';

const programRenderer = {
  outputId: 'program',
  drawnOutput: 'program',
  reportsInstanceStatus: true,
  webSocketPath: '/ws?role=renderer',
  stateReadingPath: '/api/v1/state?role=renderer',
};
const programMonitor = {
  outputId: 'program',
  drawnOutput: 'program',
  reportsInstanceStatus: false,
  webSocketPath: '/ws?role=monitor',
  stateReadingPath: '/api/v1/state?role=monitor',
};
const previewPage = {
  outputId: 'program',
  drawnOutput: 'preview',
  reportsInstanceStatus: false,
  webSocketPath: '/ws?role=monitor',
  stateReadingPath: '/api/v1/state?role=monitor',
};

const pageAddressScenarios = [
  // What OBS loads: http://192.168.0.10:3000/render/ with no query at all.
  {
    name: 'is the program renderer when the address has no query',
    pageAddressSearch: '',
    expectedRole: programRenderer,
  },
  // What the control page frames as "Programa": /render/?monitor=1.
  {
    name: 'is a program monitor when the address says monitor=1',
    pageAddressSearch: '?monitor=1',
    expectedRole: programMonitor,
  },
  // A cache-busting parameter in front must not turn a monitor into a second "OBS".
  {
    name: 'is a program monitor when monitor=1 comes after another parameter',
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
  // The preview page opened on its own, for example in a browser tab while rehearsing.
  // It is not the program output, so it is silent even without monitor=1.
  {
    name: 'is a silent preview page when the address says target=preview',
    pageAddressSearch: '?target=preview',
    expectedRole: previewPage,
  },
  // What the control page frames as "Prévia": /render/?target=preview&monitor=1.
  {
    name: 'is a silent preview page when the address says target=preview and monitor=1',
    pageAddressSearch: '?target=preview&monitor=1',
    expectedRole: previewPage,
  },
  // The order of the two parameters in the address must not matter.
  {
    name: 'is a silent preview page when monitor=1 comes before target=preview',
    pageAddressSearch: '?monitor=1&target=preview',
    expectedRole: previewPage,
  },
  // Parameters the renderer does not know, around the one it does, change nothing.
  {
    name: 'is a silent preview page when target=preview sits among unknown parameters',
    pageAddressSearch: '?recarregado=1728650000&target=preview&tema=escuro',
    expectedRole: previewPage,
  },
  // Naming the program output out loud is the same as not naming any: OBS keeps reporting.
  {
    name: 'is the program renderer when the address says target=program',
    pageAddressSearch: '?target=program',
    expectedRole: programRenderer,
  },
  // The program output named out loud, framed as a monitor, is still a silent monitor.
  {
    name: 'is a program monitor when the address says target=program and monitor=1',
    pageAddressSearch: '?target=program&monitor=1',
    expectedRole: programMonitor,
  },
  // Only the exact lower-case word counts, so a stray or mistyped parameter can never
  // turn the page OBS loads into a preview page and take the stream's graphics away.
  {
    name: 'is the program renderer when target is written in capitals',
    pageAddressSearch: '?target=PREVIEW',
    expectedRole: programRenderer,
  },
  // A half-typed address: `target` with nothing after it is not the agreed value either.
  {
    name: 'is the program renderer when target has no value',
    pageAddressSearch: '?target',
    expectedRole: programRenderer,
  },
  // A parameter that merely contains the word must not be mistaken for the switch.
  {
    name: 'is the program renderer when only a parameter named like target is present',
    pageAddressSearch: '?targetDeTeste=preview',
    expectedRole: programRenderer,
  },
  // OBS's second browser source, for the scene with the camera box: /render/?output=pip.
  {
    name: 'is the PiP renderer when the address says output=pip',
    pageAddressSearch: '?output=pip',
    expectedRole: {
      ...programRenderer,
      outputId: 'pip',
      webSocketPath: '/ws?role=renderer&output=pip',
      stateReadingPath: '/api/v1/state?role=renderer&output=pip',
    },
  },
  // The control page's "Programa" monitor switched to the PiP.
  {
    name: 'is a PiP monitor when the address says output=pip and monitor=1',
    pageAddressSearch: '?output=pip&monitor=1',
    expectedRole: {
      ...programMonitor,
      outputId: 'pip',
      webSocketPath: '/ws?role=monitor&output=pip',
      stateReadingPath: '/api/v1/state?role=monitor&output=pip',
    },
  },
  // The control page's "Prévia" monitor switched to the PiP.
  {
    name: 'is a silent PiP preview page when the address says target=preview and output=pip',
    pageAddressSearch: '?target=preview&monitor=1&output=pip',
    expectedRole: {
      ...previewPage,
      outputId: 'pip',
      webSocketPath: '/ws?role=monitor&output=pip',
      stateReadingPath: '/api/v1/state?role=monitor&output=pip',
    },
  },
  // A half-typed `output=` is program, so the main source never goes blank over it.
  {
    name: 'is the program renderer when output has no value',
    pageAddressSearch: '?output=',
    expectedRole: programRenderer,
  },
];

describe('decideRendererPageRole', () => {
  it.each(pageAddressScenarios)('$name', ({ pageAddressSearch, expectedRole }) => {
    // Arrange: the query part of the page's address is the one of the row.

    // Act: ask which role a page at that address has.
    const role = decideRendererPageRole(pageAddressSearch);

    // Assert: the output drawn, the reporting and the two server paths are the row's.
    expect(
      role,
      'only target=preview draws preview, only monitor=1 or target=preview silences a page, and output names the output passed on to the server; anything else is the reporting program renderer',
    ).toEqual(expectedRole);
  });
});

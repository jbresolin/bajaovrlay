/**
 * Decides, from the page's own address, which of its three roles this renderer page has.
 *
 *   - Program renderer: what OBS loads (`/render/`). It is the program output, so it dials
 *     `/ws?role=renderer` and tells the server what really went on air.
 *   - Program monitor: what the control page frames (`/render/?monitor=1`) so the operator
 *     can watch the picture. It draws the same graphics but dials `/ws?role=monitor` and
 *     reports nothing: only the program output is the truth (gate-2 ruling on
 *     BAJAOVRLAY-12).
 *   - Preview page: what the control page frames as "Prévia"
 *     (`/render/?target=preview&monitor=1`). It draws the screen as it will look after the
 *     take: per layer the `preview` instance, else what is on air there unless the layer
 *     is marked "will be cleared" (previewComposition.ts). It is not the program output
 *     either, so it dials `/ws?role=monitor` and reports nothing, with or without
 *     `monitor=1`.
 *
 * Every page names its role to the server, on the WebSocket and on the state read it
 * falls back to when its hello is late, so the server sends none of them the race data
 * and the event log, which no graphic reads (gate 2 on PR #16).
 *
 * What could go wrong: the default is the reporting program role, on purpose. OBS must
 * keep drawing the stream and reporting whatever is appended to its address, so only the
 * exact `monitor=1` silences a page and only the exact `target=preview` makes it draw the
 * preview composition. The price is that an address typed wrong (`monitor=true`, `target=PREVIEW`)
 * draws the program output and reports like OBS.
 */
import type { Instance } from '@bajaovrlay/shared';

/** What the page draws, whether it reports, and the two server paths it must use. */
export type RendererPageRole = {
  /** `program`: program instances only. `preview`: the screen after the take (previewComposition.ts). */
  drawnOutput: Instance['target'];
  /** True only for the program renderer: the one page allowed to send `instanceStatus`. */
  reportsInstanceStatus: boolean;
  /** `/ws?role=renderer` for the page that reports, `/ws?role=monitor` for every other. */
  webSocketPath: string;
  /** Where the state is read when the hello is late: `/api/v1/state` with the same role. */
  stateReadingPath: string;
};

/**
 * Answers the role of a renderer page from the query part of its address
 * (`location.search`: `''`, `'?monitor=1'`, `'?target=preview&monitor=1'`, …). Pure: it
 * reads nothing but its argument.
 */
export function decideRendererPageRole(pageAddressSearch: string): RendererPageRole {
  const addressParameters = new URLSearchParams(pageAddressSearch);
  const isPreviewPage = addressParameters.get('target') === 'preview';
  const isMonitor = addressParameters.get('monitor') === '1';

  // A preview page never reports, whatever `monitor` says: what it draws is not on air,
  // so "on-air" from it would be a lie and "failed" would mark an instance OBS may show.
  if (isPreviewPage) {
    return {
      drawnOutput: 'preview',
      reportsInstanceStatus: false,
      webSocketPath: '/ws?role=monitor',
      stateReadingPath: '/api/v1/state?role=monitor',
    };
  }
  if (isMonitor) {
    return {
      drawnOutput: 'program',
      reportsInstanceStatus: false,
      webSocketPath: '/ws?role=monitor',
      stateReadingPath: '/api/v1/state?role=monitor',
    };
  }
  return {
    drawnOutput: 'program',
    reportsInstanceStatus: true,
    webSocketPath: '/ws?role=renderer',
    stateReadingPath: '/api/v1/state?role=renderer',
  };
}

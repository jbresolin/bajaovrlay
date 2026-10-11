/**
 * Decides, from the page's own address, which of its two roles this renderer page has.
 *
 *   - Program renderer: what OBS loads (`/render/`). It is the program output, so it dials
 *     `/ws?role=renderer` and tells the server what really went on air.
 *   - Program monitor: what the control page frames (`/render/?monitor=1`) so the operator
 *     can watch the picture. It draws the same graphics but dials plain `/ws`, like any
 *     page that is not a renderer, and reports nothing: only the program output is the
 *     truth (gate-2 ruling on BAJAOVRLAY-12).
 *
 * What could go wrong: the default is the reporting role, on purpose. OBS must keep
 * reporting whatever is appended to its address, so only the exact `monitor=1` silences a
 * page. The price is that a monitor address typed wrong (`monitor=true`) reports like OBS.
 */

/** Which role the page has and the WebSocket path, on the page's own host, it must dial. */
export type RendererPageRole = {
  isProgramMonitor: boolean;
  /** `/ws` for a monitor, `/ws?role=renderer` for the program renderer. */
  webSocketPath: string;
};

/**
 * Answers the role of a renderer page from the query part of its address
 * (`location.search`: `''`, `'?monitor=1'`, …). Pure: it reads nothing but its argument.
 */
export function decideRendererPageRole(pageAddressSearch: string): RendererPageRole {
  const monitorParameter = new URLSearchParams(pageAddressSearch).get('monitor');
  const isProgramMonitor = monitorParameter === '1';
  if (isProgramMonitor) {
    return { isProgramMonitor: true, webSocketPath: '/ws' };
  }
  return { isProgramMonitor: false, webSocketPath: '/ws?role=renderer' };
}

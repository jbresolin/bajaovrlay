/**
 * The parts of an OGraf v1 graphic the renderer calls, restated from the informative
 * TypeScript definitions (github.com/ebu/ograf, v1/typescript-definitions,
 * src/apis/graphicsAPI.ts). Restated rather than installed to keep a dependency out of
 * the renderer; packages/graphics/race-clock/src/ografGraphicTypes.ts is the graphic's
 * side of the same contract.
 */

/** What every OGraf action resolves to: an HTTP-like status, 2xx for success. */
export type OGrafAnswer = {
  statusCode: number;
  statusMessage?: string;
};

/** What the renderer passes to load(): the data to show and how it is being rendered. */
export type OGrafLoadParams = {
  data: Record<string, unknown>;
  renderType: 'realtime';
  renderCharacteristics: { resolution: { width: number; height: number } };
};

/** A graphic on the page: an ordinary element that also answers the OGraf lifecycle. */
export type OGrafGraphicElement = HTMLElement & {
  load: (params: OGrafLoadParams) => Promise<OGrafAnswer>;
  playAction: (params: { goto: number; skipAnimation?: boolean }) => Promise<OGrafAnswer>;
  updateAction: (params: { data: Record<string, unknown> }) => Promise<OGrafAnswer>;
  stopAction: (params: { skipAnimation?: boolean }) => Promise<OGrafAnswer>;
  dispose: (params: Record<string, never>) => Promise<OGrafAnswer>;
};

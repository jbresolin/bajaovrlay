/**
 * The parts of an OGraf v1 graphic the renderer calls, restated from the informative
 * TypeScript definitions (github.com/ebu/ograf, v1/typescript-definitions,
 * src/apis/graphicsAPI.ts). Restated rather than installed to keep a dependency out of
 * the renderer; packages/graphics/kit/src/ografGraphicTypes.ts is the graphics'
 * side of the same contract.
 */

/** What an OGraf action resolves to when it answers: an HTTP-like status, 2xx for success. */
export type OGrafAnswer = {
  statusCode: number;
  statusMessage?: string;
};

/**
 * What an OGraf action may resolve to: an answer, or nothing. The specification says of
 * every action: "If the returned Promise resolves to `undefined`, it MUST be treated as a
 * `{ statusCode: 200 }`." lifecycleCall.ts is where the renderer does that.
 */
export type OGrafAnswerOrNothing = OGrafAnswer | void;

/** What the renderer passes to load(): the data to show and how it is being rendered. */
export type OGrafLoadParams = {
  data: Record<string, unknown>;
  renderType: 'realtime';
  renderCharacteristics: { resolution: { width: number; height: number } };
};

/** A graphic on the page: an ordinary element that also answers the OGraf lifecycle. */
export type OGrafGraphicElement = HTMLElement & {
  load: (params: OGrafLoadParams) => Promise<OGrafAnswerOrNothing>;
  playAction: (params: { goto: number; skipAnimation?: boolean }) => Promise<OGrafAnswerOrNothing>;
  updateAction: (params: { data: Record<string, unknown> }) => Promise<OGrafAnswerOrNothing>;
  stopAction: (params: { skipAnimation?: boolean }) => Promise<OGrafAnswerOrNothing>;
  dispose: (params: Record<string, never>) => Promise<OGrafAnswerOrNothing>;
};

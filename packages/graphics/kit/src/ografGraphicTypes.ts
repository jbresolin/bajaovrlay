/**
 * The parts of the OGraf v1 Graphic interface the graphics use, restated from the
 * informative TypeScript definitions (github.com/ebu/ograf, v1/typescript-definitions,
 * src/apis/graphicsAPI.ts and src/definitions/types.ts). Restated rather than installed
 * to keep a dependency out of every graphic; vendor-specific `v_*` fields are left out.
 */

/** What an OGraf action resolves to when it answers: an HTTP-like status, 2xx for success. */
export type OGrafReturnPayload = {
  statusCode: number;
  statusMessage?: string;
};

/** playAction also reports the step now on air (undefined once it went to the end). */
export type OGrafPlayActionReturnPayload = OGrafReturnPayload & {
  currentStep?: number;
};

/** What the renderer passes to load(). */
export type OGrafLoadParams = {
  data?: unknown;
  renderType: 'realtime' | 'non-realtime';
  renderCharacteristics: {
    resolution?: { width: number; height: number };
    frameRate?: number;
    accessToPublicInternet?: boolean;
  };
};

/** What the renderer passes to playAction(). */
export type OGrafPlayActionParams = {
  delta?: number;
  goto?: number;
  skipAnimation?: boolean;
};

/** What the renderer passes to stopAction(). */
export type OGrafStopActionParams = {
  skipAnimation?: boolean;
};

/** What the renderer passes to updateAction(): possibly partial data. */
export type OGrafUpdateActionParams = {
  data: unknown;
  skipAnimation?: boolean;
};

/** What the renderer passes to customAction(). */
export type OGrafCustomActionParams = {
  id: string;
  payload: unknown;
  skipAnimation?: boolean;
};

/**
 * The methods a real-time OGraf graphic implements. goToTime and setActionsSchedule are
 * left out: they are required only with "supportsNonRealTime": true.
 *
 * Every action may also resolve with nothing (`void`). The specification says: "If the
 * returned Promise resolves to `undefined`, it MUST be treated as a `{ statusCode: 200 }`."
 * Every BajaOvrLay graphic always answers with a status; the `void` is here so the contract
 * says what the specification says.
 */
export interface OGrafGraphic {
  load: (params: OGrafLoadParams) => Promise<OGrafReturnPayload | void>;
  dispose: (params: Record<string, never>) => Promise<OGrafReturnPayload | void>;
  playAction: (params: OGrafPlayActionParams) => Promise<OGrafPlayActionReturnPayload | void>;
  stopAction: (params: OGrafStopActionParams) => Promise<OGrafReturnPayload | void>;
  updateAction: (params: OGrafUpdateActionParams) => Promise<OGrafReturnPayload | void>;
  customAction: (params: OGrafCustomActionParams) => Promise<OGrafReturnPayload | void>;
}

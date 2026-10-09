/**
 * The parts of the OGraf v1 Graphic interface this graphic uses, restated from the
 * informative TypeScript definitions (github.com/ebu/ograf, v1/typescript-definitions,
 * src/apis/graphicsAPI.ts and src/definitions/types.ts). Restated rather than installed
 * to keep a dependency out of the graphic; vendor-specific `v_*` fields are left out.
 */

/** What every OGraf action resolves to: an HTTP-like status, 2xx for success. */
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
 */
export interface OGrafGraphic {
  load: (params: OGrafLoadParams) => Promise<OGrafReturnPayload>;
  dispose: (params: Record<string, never>) => Promise<OGrafReturnPayload>;
  playAction: (params: OGrafPlayActionParams) => Promise<OGrafPlayActionReturnPayload>;
  stopAction: (params: OGrafStopActionParams) => Promise<OGrafReturnPayload>;
  updateAction: (params: OGrafUpdateActionParams) => Promise<OGrafReturnPayload>;
  customAction: (params: OGrafCustomActionParams) => Promise<OGrafReturnPayload>;
}

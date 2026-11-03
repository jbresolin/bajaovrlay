import { z } from 'zod';

/**
 * How the server's one connection to OBS stands (BAJAOVRLAY-27), in the words the page
 * shows:
 * - `desligado`: BAJAOVRLAY_OBS_URL is not set, so the server never connects ("OBS não
 *   configurado");
 * - `conectando`: the first attempt since the boot is under way;
 * - `conectado`: OBS answered, and the scene list is the one OBS has now;
 * - `erro`: OBS is not answering, refused the password or dropped the connection. The
 *   server tries again every 5 s and stays in `erro`, with its reason, until it is back.
 */
export const ObsConnectionStateSchema = z.enum(['desligado', 'conectando', 'conectado', 'erro']);

/** One of ObsConnectionStateSchema's values. */
export type ObsConnectionState = z.infer<typeof ObsConnectionStateSchema>;

/** Which of OBS's two outputs a scene switch changes: Program, or Preview in Studio Mode. */
export const ObsSceneTargetSchema = z.enum(['program', 'preview']);

/** One of ObsSceneTargetSchema's values. */
export type ObsSceneTarget = z.infer<typeof ObsSceneTargetSchema>;

/**
 * What OBS is doing, as the server last heard it: the connection, the scenes in OBS's
 * own order (the order of its Scenes panel, top first), the scene on Program, and, only
 * while Studio Mode is on, the scene on Preview. Without a connection the scenes are
 * empty and no scene is named: the page must never show a scene as live that OBS may no
 * longer be showing.
 */
export const ObsStatusSchema = z.object({
  connectionState: ObsConnectionStateSchema,
  /**
   * Where the server connects (`ws://127.0.0.1:4455`), scheme, host and port only, for
   * the tally's hover. Null when BAJAOVRLAY_OBS_URL is not set. Never the password.
   */
  address: z.string().nullable(),
  /** The last reason the connection failed, in pt-BR; kept after OBS comes back. */
  lastError: z.string().nullable(),
  sceneNames: z.array(z.string()),
  programSceneName: z.string().nullable(),
  isStudioModeOn: z.boolean(),
  /** Null while Studio Mode is off: OBS then has no separate Preview. */
  previewSceneName: z.string().nullable(),
});

/** An ObsStatus that has passed ObsStatusSchema. */
export type ObsStatus = z.infer<typeof ObsStatusSchema>;

/**
 * Where the latest switchObsScene stands: `enviada` once the server accepted it and is
 * waiting for OBS's answer, then `feita` or `recusada` with OBS's reason in pt-BR. The
 * macro runner waits on this before its next step, so a graphic never goes on air over
 * the wrong scene. `number` counts the switches since the boot, so the runner can tell
 * its own answer from an older one.
 */
export const ObsSceneSwitchSchema = z.object({
  number: z.number().int().min(1),
  sceneName: z.string().min(1),
  target: ObsSceneTargetSchema,
  status: z.enum(['enviada', 'feita', 'recusada']),
  refusalReason: z.string().nullable(),
  /**
   * Who asked for the switch: an operator, a device of the command API, or a macro's
   * runner (`sistema:macro:<macroId>`). The triggers read it (BAJAOVRLAY-48): a scene
   * change a macro made fires no scene trigger, told apart by this, never by timing.
   */
  requestedBy: z.string().min(1),
});

/** An ObsSceneSwitch that has passed ObsSceneSwitchSchema. */
export type ObsSceneSwitch = z.infer<typeof ObsSceneSwitchSchema>;

/**
 * The `obs` slice: OBS's status and the latest scene switch, or null before the first.
 * Kept in the server's memory only, never saved: at a boot it is refilled from OBS.
 */
export const ObsSliceSchema = ObsStatusSchema.extend({
  sceneSwitch: ObsSceneSwitchSchema.nullable(),
});

/** The `obs` slice after validation. */
export type ObsSlice = z.infer<typeof ObsSliceSchema>;

/**
 * The `obs` slice of a server with no OBS address: what every boot starts from, and what
 * a screen is sent, since the renderer draws nothing of OBS.
 */
export const obsSliceWithoutObs: ObsSlice = {
  connectionState: 'desligado',
  address: null,
  lastError: null,
  sceneNames: [],
  programSceneName: null,
  isStudioModeOn: false,
  previewSceneName: null,
  sceneSwitch: null,
};

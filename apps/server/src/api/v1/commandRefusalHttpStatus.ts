import type { CommandErrorCode } from '@bajaovrlay/shared';

/** The statuses the command API answers a refusal with. */
export type CommandRefusalHttpStatus = 400 | 403 | 409 | 422 | 500;

/**
 * The HTTP status of each refusal code, so a tool can branch without reading the code:
 * - 400, the command or the message itself is malformed;
 * - 403, this sender may not send this command;
 * - 422, the command names something that does not exist, or carries content that
 *   cannot be used (pressing again will not help until something is edited);
 * - 409, the state right now is in the way (pressing again later may work);
 * - 500, the server broke.
 * A Record over every code, so a new code does not compile until it is classed here.
 * Deliberate: an unknown id is 422, not 404, as the brief asks (the address exists; it
 * is the command that names nothing).
 */
const httpStatusOfEachRefusalCode: Record<CommandErrorCode, CommandRefusalHttpStatus> = {
  INVALID_COMMAND: 400,
  INVALID_MESSAGE: 400,
  // An HTTP trigger's body that is not flat JSON, or is over 8 KB (BAJAOVRLAY-48).
  INVALID_TRIGGER_BODY: 400,
  NOT_ALLOWED: 403,
  // Never answered any more; kept so an old event-log row still parses.
  UNAUTHORIZED_COMMAND: 403,
  UNEXPECTED_SERVER_ERROR: 500,
  // A reference to something that does not exist.
  LAYER_NOT_FOUND: 422,
  GRAPHIC_NOT_FOUND: 422,
  INSTANCE_NOT_FOUND: 422,
  ITEM_NOT_FOUND: 422,
  RUNDOWN_NOT_FOUND: 422,
  QUICK_FIRE_PANEL_NOT_FOUND: 422,
  QUICK_FIRE_BUTTON_NOT_FOUND: 422,
  MACRO_NOT_FOUND: 422,
  DATA_SOURCE_NOT_FOUND: 422,
  RECORDING_NOT_FOUND: 422,
  EVENT_NOT_FOUND: 422,
  MEDIA_NOT_FOUND: 422,
  OUTPUT_NOT_FOUND: 422,
  TRIGGER_NOT_FOUND: 422,
  TRIGGER_FIRING_NOT_FOUND: 422,
  // Content that cannot be used as sent.
  INVALID_GRAPHIC_DATA: 422,
  // A plain sponsor roll none of whose sponsors has a logo (BAJAOVRLAY-64).
  NOTHING_TO_SHOW: 422,
  ITEM_NOT_IN_RUNDOWN: 422,
  ITEMS_NOT_A_PERMUTATION: 422,
  UNSUPPORTED_FIELD_KIND: 422,
  INVALID_DATA_SOURCE_CONFIG: 422,
  DATA_SOURCE_NOT_A_SIMULATOR: 422,
  DATA_SOURCE_HOST_NOT_ALLOWED: 422,
  INVALID_BINDING: 422,
  INVALID_OVERRIDE_VALUE: 422,
  INVALID_EVENT_FIELD: 422,
  ITEM_NOT_FILLED_BY_EVENT: 422,
  INVALID_ENTITY_REFERENCE: 422,
  OUTPUTS_NOT_A_PERMUTATION: 422,
  LAYERS_NOT_A_PERMUTATION: 422,
  PROGRAM_OUTPUT_KEPT: 422,
  FALLBACK_LAYER_KEPT: 422,
  // A scene OBS does not have: the button or OBS must be changed first.
  OBS_SCENE_NOT_FOUND: 422,
  // The state right now is in the way.
  RUNDOWN_CURSOR_EMPTY: 409,
  LAYER_PREVIEW_EMPTY: 409,
  NOTHING_IN_PREVIEW: 409,
  NOTHING_ON_AIR_ON_LAYER: 409,
  NO_NEXT_STEP: 409,
  STEP_ALREADY_MOVED: 409,
  NOTHING_TO_UNDO: 409,
  QUICK_FIRE_PANEL_NOT_EMPTY: 409,
  LAST_QUICK_FIRE_PANEL: 409,
  MACRO_RUNNING: 409,
  INSTANCE_WITHOUT_ITEM: 409,
  NOTHING_CHANGED_ON_AIR: 409,
  DATA_SOURCE_DISABLED: 409,
  BINDING_NOT_RESOLVED: 409,
  EVENT_NOT_WAITING: 409,
  EVENT_NOT_APPROVED: 409,
  EVENT_NOT_APPROVABLE: 409,
  EVENT_NOT_DISMISSED: 409,
  EVENT_TOO_OLD: 409,
  PENALTY_WITHOUT_CAR: 422,
  GENERAL_NOTICE_WITH_TEAM: 422,
  TEMPLATE_NOT_ON_QUICK_FIRE: 422,
  EVENT_RULE_WITHOUT_ITEM: 409,
  ITEM_FILLED_BY_EVENT: 409,
  EVENT_FIELD_NOT_FILLED: 409,
  MEDIA_IN_USE: 409,
  ENTITY_NOT_RESOLVED: 409,
  OUTPUT_ALREADY_EXISTS: 409,
  OUTPUT_HAS_LAYERS: 409,
  LAYER_ALREADY_EXISTS: 409,
  LAYER_ZINDEX_TAKEN: 409,
  LAYER_NOT_EMPTY: 409,
  LAYER_IN_USE: 409,
  // OBS closed, Studio Mode off, or OBS still answering the switch before.
  OBS_NOT_CONNECTED: 409,
  OBS_STUDIO_MODE_OFF: 409,
  OBS_SCENE_SWITCH_PENDING: 409,
  // Only ever an event-log row's error, never an answer; classed with the state of OBS.
  OBS_REFUSED_SCENE_SWITCH: 409,
  // Triggers (BAJAOVRLAY-48): a firing no longer waiting, a macro in use, data missing.
  TRIGGER_FIRING_NOT_WAITING: 409,
  TRIGGER_FIRING_NOT_DISMISSED: 409,
  MACRO_USED_BY_TRIGGER: 409,
  TRIGGER_DATA_NOT_FILLED: 409,
  TRIGGER_NOT_FIRED: 409,
  // The match focus (BAJAOVRLAY-65): an unknown match, or brackets that changed meanwhile.
  BRACKET_MATCH_NOT_FOUND: 422,
  BRACKETS_NOT_SENT: 409,
  BRACKET_SESSION_CHANGED: 409,
  NO_SUGGESTED_BRACKET_MATCH: 409,
  BRACKET_PROPOSAL_CHANGED: 409,
};

/** The HTTP status the command API answers a refusal with this code with. */
export function chooseHttpStatusOfCommandRefusal(code: CommandErrorCode): CommandRefusalHttpStatus {
  return httpStatusOfEachRefusalCode[code];
}

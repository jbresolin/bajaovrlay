import { z } from 'zod';

/**
 * Every reason the server can give for not running a command or not understanding a
 * message. The list is closed so a client can react to a code without parsing text.
 */
export const CommandErrorCodeSchema = z.enum([
  /** The command's shape is wrong; the message names the field. */
  'INVALID_COMMAND',
  /**
   * The authorisation step said no, under its older name. Kept on purpose (João's
   * ruling, 2026-10-10) so that event-log rows written before BAJAOVRLAY-12 still parse:
   * the event log keeps every row ever written, and a row carrying this code must
   * still pass its schema. The server answers NOT_ALLOWED now and never this code.
   * What could go wrong if it is removed: a stored row fails EventLogEntrySchema.
   */
  'UNAUTHORIZED_COMMAND',
  /** This sender may not send this command (for example, an operator reporting a status). */
  'NOT_ALLOWED',
  /** The command names a layer that does not exist. */
  'LAYER_NOT_FOUND',
  /** The command names a graphic that is not registered. */
  'GRAPHIC_NOT_FOUND',
  /** The command names an instance that is not on any layer (never taken, or cleared). */
  'INSTANCE_NOT_FOUND',
  /** The data does not fit the graphic's manifest schema; the message names the field. */
  'INVALID_GRAPHIC_DATA',
  /** A WebSocket message that is not JSON or not in the protocol. */
  'INVALID_MESSAGE',
  /** Something broke on the server (for example, saving to the database). */
  'UNEXPECTED_SERVER_ERROR',
  /** The command names an item that does not exist (never created, or deleted). */
  'ITEM_NOT_FOUND',
  /** The command names a rundown that does not exist. */
  'RUNDOWN_NOT_FOUND',
  /** moveCursor named an item that exists but belongs to another rundown. */
  'ITEM_NOT_IN_RUNDOWN',
  /** reorderItems sent a list that is not exactly the rundown's items, once each. */
  'ITEMS_NOT_A_PERMUTATION',
  /** takeNext was sent while the rundown's cursor is on nothing. */
  'RUNDOWN_CURSOR_EMPTY',
  /**
   * An item has a field value of a kind the server cannot resolve: a guard kept for a
   * kind added to the schema before the resolver has its case (entity references had
   * it until BAJAOVRLAY-19).
   */
  'UNSUPPORTED_FIELD_KIND',
  /** takePreview named a layer that has nothing on its preview output. */
  'LAYER_PREVIEW_EMPTY',
  /** takeAllPreviews ("Tomar tudo") found no preview instance and no "will be cleared" marker. */
  'NOTHING_IN_PREVIEW',
  /** nextOnLayer ("Próximo") named a layer with nothing on its program output (BAJAOVRLAY-47). */
  'NOTHING_ON_AIR_ON_LAYER',
  /** nextOnLayer named a layer whose graphic has one step, or is on its last step. */
  'NO_NEXT_STEP',
  /** nextOnLayer's fromStep is not the step the graphic is on: another press moved it first. */
  'STEP_ALREADY_MOVED',
  /** The command names a quick-fire panel that does not exist. */
  'QUICK_FIRE_PANEL_NOT_FOUND',
  /**
   * The command API's fire-shortcut/<panelId>/<n> named a button number the panel does
   * not have (past its last button, 0, or not a number). Answered by that route alone,
   * before any command is built, so the store never answers it (BAJAOVRLAY-28).
   */
  'QUICK_FIRE_BUTTON_NOT_FOUND',
  /** deleteQuickFirePanel named a panel that still has items. */
  'QUICK_FIRE_PANEL_NOT_EMPTY',
  /** deleteQuickFirePanel named the only panel left; there is always at least one. */
  'LAST_QUICK_FIRE_PANEL',
  /** The command names a macro that does not exist. */
  'MACRO_NOT_FOUND',
  /**
   * A macro is running: runMacro while any macro runs (this one included), or
   * updateMacro / deleteMacro of the macro that is running.
   */
  'MACRO_RUNNING',
  /**
   * saveOnAirChangesIntoItem named an instance with no item behind it: one put on air by
   * hand before BAJAOVRLAY-37 ("sem item" in Camadas, which offers "Salvar como item").
   */
  'INSTANCE_WITHOUT_ITEM',
  /** saveOnAirChangesIntoItem named an instance with nothing changed on air since its take. */
  'NOTHING_CHANGED_ON_AIR',
  /** The command names a data source that does not exist (never created, or deleted). */
  'DATA_SOURCE_NOT_FOUND',
  /** A source's config does not fit the schema of its kind; the message names `config.<field>`. */
  'INVALID_DATA_SOURCE_CONFIG',
  /** pollDataSourceNow, restartSimulatedRace or startRecording named a source that is off. */
  'DATA_SOURCE_DISABLED',
  /** restartSimulatedRace named a source that is not a simulator (a replay has no race). */
  'DATA_SOURCE_NOT_A_SIMULATOR',
  /** A replay names a recording that does not exist or is still being recorded. */
  'RECORDING_NOT_FOUND',
  /** A flex source's request goes to a host not on the server's BAJAOVRLAY_SOURCE_ALLOWED_HOSTS. */
  'DATA_SOURCE_HOST_NOT_ALLOWED',
  /**
   * An item field's binding cannot be saved: its source does not exist, its path,
   * car number or transform make no sense, or its value does not fit the graphic's field.
   * The message starts with the field's title.
   */
  'INVALID_BINDING',
  /**
   * A take or a preview could not read a bound field: its source does not exist, has no
   * data yet or does not send that shape, or a required field's value is absent from the
   * snapshot. The message starts with the field's title and names the source.
   */
  'BINDING_NOT_RESOLVED',
  /** setOverride carried a value its canonical field cannot hold; the message names the field. */
  'INVALID_OVERRIDE_VALUE',
  /** showEvent or dismissEvent named an event the inbox does not hold (BAJAOVRLAY-44). */
  'EVENT_NOT_FOUND',
  /**
   * showEvent or dismissEvent named an event that is no longer waiting: already on air,
   * shown, dismissed or expired. The message says which.
   */
  'EVENT_NOT_WAITING',
  /**
   * restoreEvent named an event that was not dismissed (waiting, on air, shown or
   * expired); only a dismissal can be undone. The message says its status.
   */
  'EVENT_NOT_DISMISSED',
  /**
   * restoreEvent named a dismissed event past its rule's maximum wait: it would only
   * expire at "No ar", so it stays dismissed. A kind with no maximum wait never is.
   */
  'EVENT_TOO_OLD',
  /** showEvent named an event whose rule has no item to show it with ("Regras"). */
  'EVENT_RULE_WITHOUT_ITEM',
  /**
   * A take of an item filled by an event (an item with "Evento" fields) that no event
   * fills: such an item goes on air only through showEvent. Also "Tomar" on its Prévia
   * filled from a sample event.
   */
  'ITEM_FILLED_BY_EVENT',
  /** An event shown on an item with a required field the event does not carry. */
  'EVENT_FIELD_NOT_FILLED',
  /**
   * createItem or updateItemFields carried an event field whose payload field does not fit
   * the graphic's field; the message starts with the field's title.
   */
  'INVALID_EVENT_FIELD',
  /**
   * updateEventRule named an item no event fills (no "Evento" field): it would go on air in
   * place of a notice and leave after the rule's time (gate 2 of PR #22).
   */
  'ITEM_NOT_FILLED_BY_EVENT',
  /**
   * A record of the entity library names an image the media store does not hold; the
   * message names the field ("Logo: …").
   */
  'MEDIA_NOT_FOUND',
  /** deleteMedia named an image a record still uses; the message lists the uses. */
  'MEDIA_IN_USE',
  /**
   * An item field's entity reference cannot be saved: its record is not in the library,
   * its attribute does not exist, or its value does not fit the field. The message
   * starts with the field's title.
   */
  'INVALID_ENTITY_REFERENCE',
  /**
   * A take or a preview could not read a field from the entity library: its record is
   * not there (deleted), or a required field's attribute is absent (no logo). The message
   * starts with the field's title and names the record.
   */
  'ENTITY_NOT_RESOLVED',
  /** The command names an output that does not exist (BAJAOVRLAY-49). */
  'OUTPUT_NOT_FOUND',
  /** createOutput named an id another output already has. */
  'OUTPUT_ALREADY_EXISTS',
  /** deleteOutput named program, which always exists. */
  'PROGRAM_OUTPUT_KEPT',
  /** deleteOutput named an output that still has layers; the message lists them. */
  'OUTPUT_HAS_LAYERS',
  /** reorderOutputs sent a list that is not exactly the outputs, once each. */
  'OUTPUTS_NOT_A_PERMUTATION',
  /** createLayer named an id another layer already has. */
  'LAYER_ALREADY_EXISTS',
  /** A layer would sit at the zIndex of another layer of the same output. */
  'LAYER_ZINDEX_TAKEN',
  /**
   * deleteLayer or moveLayerToOutput named a layer with something on it: on air, in
   * preview or marked "vai limpar". The message says which.
   */
  'LAYER_NOT_EMPTY',
  /**
   * deleteLayer named a layer that items, quick-fire buttons, macro steps or event rules
   * name; the message lists them.
   */
  'LAYER_IN_USE',
  /** reorderLayers sent a list that is not exactly the output's layers, once each. */
  'LAYERS_NOT_A_PERMUTATION',
  /**
   * deleteLayer of the fullscreen layer, or moveLayerToOutput of it off program: it is
   * where every graphic without a usable default layer goes (gate 2 of PR #32).
   */
  'FALLBACK_LAYER_KEPT',
  /**
   * switchObsScene while the server is not connected to OBS: no address set, OBS closed,
   * or the password refused (BAJAOVRLAY-27).
   */
  'OBS_NOT_CONNECTED',
  /** switchObsScene named a scene OBS does not have (renamed, deleted, or mistyped). */
  'OBS_SCENE_NOT_FOUND',
  /** switchObsScene for Preview while Studio Mode is off: OBS then has no Preview. */
  'OBS_STUDIO_MODE_OFF',
  /** switchObsScene while OBS has not answered the switch before it yet. */
  'OBS_SCENE_SWITCH_PENDING',
  /**
   * OBS itself refused a switch the server sent, did not answer it in time, or dropped the
   * connection first. Written to the event log on the connection's answer; never the
   * answer to a command, since the switch was accepted before OBS was asked.
   */
  'OBS_REFUSED_SCENE_SWITCH',
  /** The command names a trigger that does not exist (BAJAOVRLAY-48). */
  'TRIGGER_NOT_FOUND',
  /** The command names a firing no longer in the list (or never there). */
  'TRIGGER_FIRING_NOT_FOUND',
  /** "Rodar" or "Descartar" of a firing that no longer waits: it ran or was dismissed. */
  'TRIGGER_FIRING_NOT_WAITING',
  /** "Desfazer" of a firing that is not dismissed. */
  'TRIGGER_FIRING_NOT_DISMISSED',
  /** deleteMacro of a macro that triggers name; the message lists them. */
  'MACRO_USED_BY_TRIGGER',
  /**
   * A take step's required field reads a key the trigger's data does not have (or the
   * macro was run by hand, with no trigger data). The message starts with the field's title.
   */
  'TRIGGER_DATA_NOT_FILLED',
  /**
   * POST /api/v1/triggers/:triggerId with a body that is not a flat JSON object of texts
   * and numbers, or is over 8 KB. Only ever an HTTP answer (400), never a command's.
   */
  'INVALID_TRIGGER_BODY',
  /**
   * POST /api/v1/triggers/:triggerId for a trigger that may not fire now: off, paused, or
   * within its minimum interval. Only ever an HTTP answer (409); the message says which.
   */
  'TRIGGER_NOT_FIRED',
]);

/** One of CommandErrorCodeSchema's values. */
export type CommandErrorCode = z.infer<typeof CommandErrorCodeSchema>;

/** Why a command was not run: a stable code for code, a pt-BR message for the operator. */
export const CommandErrorSchema = z.object({
  code: CommandErrorCodeSchema,
  message: z.string().min(1),
});

/** A command error that has passed CommandErrorSchema. */
export type CommandError = z.infer<typeof CommandErrorSchema>;

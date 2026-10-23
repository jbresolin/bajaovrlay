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
   * An item has a field value of a kind the server cannot resolve yet: an entity
   * reference, until the entity library (BAJAOVRLAY-19).
   */
  'UNSUPPORTED_FIELD_KIND',
  /** takePreview named a layer that has nothing on its preview output. */
  'LAYER_PREVIEW_EMPTY',
  /** takeAllPreviews ("Tomar tudo") found no preview instance and no "will be cleared" marker. */
  'NOTHING_IN_PREVIEW',
  /** The command names a quick-fire panel that does not exist. */
  'QUICK_FIRE_PANEL_NOT_FOUND',
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

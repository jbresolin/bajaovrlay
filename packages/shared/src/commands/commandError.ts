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
  /** An item has a field value of a kind the server cannot resolve before M2. */
  'UNSUPPORTED_FIELD_KIND',
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

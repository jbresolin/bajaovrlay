import { z } from 'zod';

/**
 * Every reason the server can give for not running a command or not understanding a
 * message. The list is closed so a client can react to a code without parsing text.
 */
export const CommandErrorCodeSchema = z.enum([
  /** The command's shape is wrong; the message names the field. */
  'INVALID_COMMAND',
  /** The authorisation step said no. */
  'UNAUTHORIZED_COMMAND',
  /** The command names a layer that does not exist. */
  'LAYER_NOT_FOUND',
  /** The command names a graphic that is not registered. */
  'GRAPHIC_NOT_FOUND',
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

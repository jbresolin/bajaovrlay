import { z } from 'zod';

/**
 * Every reason the server can give for not running a command or not understanding a
 * message. The list is closed so a client can react to a code without parsing text.
 */
export const CommandErrorCodeSchema = z.enum([
  /** The command's shape is wrong; the message names the field. */
  'INVALID_COMMAND',
  /**
   * The authorisation step said no. NOT_ALLOWED is what the server answers since
   * BAJAOVRLAY-12; this older name stays in the list only because the event log keeps
   * every row ever written, and a row carrying it must still pass its schema.
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

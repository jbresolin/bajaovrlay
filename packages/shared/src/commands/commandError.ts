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

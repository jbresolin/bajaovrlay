import { z } from 'zod';

/**
 * A client asks the server to run one command. The command itself is deliberately not
 * checked here: the server's store checks it against CommandSchema, so a bad command is
 * still written to the event log, with the field that is wrong named in the error.
 */
export const CommandMessageSchema = z.object({
  type: z.literal('command'),
  /** Any id the client likes; the server echoes it in the commandResult. */
  requestId: z.string().min(1).max(200).optional(),
  command: z.unknown(),
});

/**
 * Every message a client may send, told apart by `type`. Only `command` exists today;
 * it is a union so every client message is parsed the same way as more kinds arrive.
 */
export const ClientMessageSchema = z.discriminatedUnion('type', [CommandMessageSchema]);

/** Any client message after validation. */
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

import { z } from 'zod';

import { ReportedInstanceStatusSchema } from '../commands/reportInstanceStatus.js';

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

/** One command message after validation. */
export type CommandMessage = z.infer<typeof CommandMessageSchema>;

/**
 * The renderer tells the server what really happened to an instance on screen: `on-air`
 * after its play finished, `failed` after an import, load or play that did not work.
 * Unlike `command`, it is checked in full here, because the server turns it into a
 * reportInstanceStatus command itself. It carries no requestId: the renderer does not
 * wait for an answer.
 */
export const InstanceStatusMessageSchema = z.object({
  type: z.literal('instanceStatus'),
  instanceId: z.string().min(1),
  status: ReportedInstanceStatusSchema,
  /** What went wrong, in words; left out when there is nothing to add. */
  detail: z.string().min(1).optional(),
});

/** One instanceStatus message after validation. */
export type InstanceStatusMessage = z.infer<typeof InstanceStatusMessageSchema>;

/** Every message a client may send, told apart by `type`. */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  CommandMessageSchema,
  InstanceStatusMessageSchema,
]);

/** Any client message after validation. */
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

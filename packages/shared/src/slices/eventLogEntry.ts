import { z } from 'zod';

import { CommandErrorSchema } from '../commands/commandError.js';

/** How a command ended: ok, or failed with the error the operator was shown. */
export const EventLogResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok') }),
  z.object({ status: z.literal('failed'), error: CommandErrorSchema }),
]);

/**
 * One line of the append-only event log: who sent which command, when, with what
 * payload, and how it ended. Failed commands are logged too; an accepted command that
 * changed nothing (a clear of an empty stage) is not, and neither is a routine
 * data-source poll that left its source's health as it was (decision D11).
 */
export const EventLogEntrySchema = z.object({
  /** The event_log row id; it increases with every logged command, so it gives the order. */
  id: z.number().int().positive(),
  /** When the command was applied, as an ISO 8601 timestamp. */
  ts: z.iso.datetime(),
  /** Who sent it, e.g. `operador:<connection id>`. */
  actor: z.string().min(1),
  /** The command's `type`, or `unknown` when what was sent had none. */
  command: z.string().min(1),
  /**
   * The command as validated, or exactly as received when it was invalid; when nothing
   * was sent at all, `{ "commandWasMissing": true }`.
   */
  payload: z.unknown(),
  result: EventLogResultSchema,
});

/** An event-log entry that has passed EventLogEntrySchema. */
export type EventLogEntry = z.infer<typeof EventLogEntrySchema>;

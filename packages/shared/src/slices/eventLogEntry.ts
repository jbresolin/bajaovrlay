import { z } from 'zod';

import { CommandErrorSchema } from '../commands/commandError.js';
import { InboxEventStatusSchema } from '../eventInbox/inboxEventsSlice.js';
import { OperatorRoleSchema } from '../operatorLogin/operatorRole.js';

/** How a command ended: ok, or failed with the error the operator was shown. */
export const EventLogResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok') }),
  z.object({ status: z.literal('failed'), error: CommandErrorSchema }),
]);

/**
 * One layer a console's take was refused on because another console had just changed it
 * (BAJAOVRLAY-69), as the event log keeps it: the layer, the role of the console whose take
 * was refused and of the console that changed the layer, and when that change was. A role
 * is left out when that console had no login (the PINs unset); no name is ever kept.
 */
export const TakeRefusedForAnotherConsoleSchema = z.object({
  layerId: z.string().min(1),
  refusedConsoleRole: OperatorRoleSchema.optional(),
  otherConsoleRole: OperatorRoleSchema.optional(),
  otherConsoleChangedAt: z.iso.datetime(),
});

/** One TakeRefusedForAnotherConsoleSchema value. */
export type TakeRefusedForAnotherConsole = z.infer<typeof TakeRefusedForAnotherConsoleSchema>;

/**
 * What the server knew when it applied a command and the payload does not say (gate 2 of
 * PR #44). `placedOn` is the layer a take or a preview put its item on, and that layer's
 * output, as they were then: the history names them, not the item's layer now, which
 * may have moved since. `restoredFrom` is the status a restoreEvent brought its event
 * back from (BAJAOVRLAY-67), so the history tells "Mostrar de novo" from an undone discard.
 * `takesRefusedForAnotherConsole` (BAJAOVRLAY-69) is on a take refused because another
 * console had just changed its layer, and on a "Tomar tudo" that left such layers: one entry
 * per layer, with both consoles' roles.
 */
export const EventLogDetailsSchema = z.object({
  placedOn: z.object({ layerId: z.string().min(1), outputId: z.string().min(1) }).optional(),
  restoredFrom: InboxEventStatusSchema.optional(),
  takesRefusedForAnotherConsole: z.array(TakeRefusedForAnotherConsoleSchema).min(1).optional(),
});

/** The details of an event-log row, after validation. */
export type EventLogDetails = z.infer<typeof EventLogDetailsSchema>;

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
  /** Left out when there is nothing to add, as in every row written before gate 2 of PR #44. */
  details: EventLogDetailsSchema.optional(),
});

/** An event-log entry that has passed EventLogEntrySchema. */
export type EventLogEntry = z.infer<typeof EventLogEntrySchema>;

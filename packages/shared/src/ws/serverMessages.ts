import { z } from 'zod';

import { CommandErrorSchema } from '../commands/commandError.js';
import { ItemSchema } from '../rundown/item.js';
import { RundownSchema } from '../rundown/rundown.js';
import { EventLogEntrySchema } from '../slices/eventLogEntry.js';
import { GraphicSchema } from '../slices/graphic.js';
import { InstanceSchema } from '../slices/instance.js';
import { LayerSchema } from '../slices/layer.js';
import { SlicesSchema } from '../slices/slices.js';

/**
 * The server's wall clock, in whole milliseconds since 1970, at the moment a `hello` or
 * `slice` message was built. A renderer compares it with its own clock, so the race
 * clock on air counts on the server's clock (packages/shared/src/clock/serverAlignedTime.ts).
 * Deliberate: optional here although the server always sends it. Thirteen test files of
 * the control page build these messages by hand, and making the field required meant
 * editing all of them while another task was changing that app. A client that gets a
 * message without it takes no sample; it loses nothing else.
 */
const ServerNowMsSchema = z.number().int().optional();

/** Sent once, right after a client connects: every slice, and the server's clock time. */
export const HelloMessageSchema = z.object({
  type: z.literal('hello'),
  slices: SlicesSchema,
  serverNowMs: ServerNowMsSchema,
});

/**
 * Sent to every client when one slice changes. The `name` decides what `slice` must
 * contain, so a client can never store layers as instances. Each one carries the
 * server's clock time, as `hello` does.
 */
export const SliceMessageSchema = z.discriminatedUnion('name', [
  z.object({
    type: z.literal('slice'),
    name: z.literal('layers'),
    slice: z.array(LayerSchema),
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('graphics'),
    slice: z.array(GraphicSchema),
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('instances'),
    slice: z.array(InstanceSchema),
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('rundowns'),
    slice: z.array(RundownSchema),
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('items'),
    slice: z.array(ItemSchema),
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('eventLog'),
    slice: z.array(EventLogEntrySchema),
    serverNowMs: ServerNowMsSchema,
  }),
]);

/** One slice message after validation. */
export type SliceMessage = z.infer<typeof SliceMessageSchema>;

/**
 * Sent to the client that sent a command (or an unreadable message): ok, or an error
 * with a stable code and a pt-BR message. `requestId` echoes the client's, or is null.
 */
export const CommandResultMessageSchema = z.discriminatedUnion('ok', [
  z.object({
    type: z.literal('commandResult'),
    requestId: z.string().nullable(),
    ok: z.literal(true),
  }),
  z.object({
    type: z.literal('commandResult'),
    requestId: z.string().nullable(),
    ok: z.literal(false),
    error: CommandErrorSchema,
  }),
]);

/** One commandResult message after validation. */
export type CommandResultMessage = z.infer<typeof CommandResultMessageSchema>;

/** Every message the server sends, told apart by `type`. */
export const ServerMessageSchema = z.discriminatedUnion('type', [
  HelloMessageSchema,
  SliceMessageSchema,
  CommandResultMessageSchema,
]);

/** Any server message after validation. */
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

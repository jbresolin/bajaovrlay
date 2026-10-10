import { z } from 'zod';

import { CommandErrorSchema } from '../commands/commandError.js';
import { EventLogEntrySchema } from '../slices/eventLogEntry.js';
import { GraphicSchema } from '../slices/graphic.js';
import { InstanceSchema } from '../slices/instance.js';
import { LayerSchema } from '../slices/layer.js';
import { SlicesSchema } from '../slices/slices.js';

/** Sent once, right after a client connects: every slice. */
export const HelloMessageSchema = z.object({
  type: z.literal('hello'),
  slices: SlicesSchema,
});

/**
 * Sent to every client when one slice changes. The `name` decides what `slice` must
 * contain, so a client can never store layers as instances.
 */
export const SliceMessageSchema = z.discriminatedUnion('name', [
  z.object({ type: z.literal('slice'), name: z.literal('layers'), slice: z.array(LayerSchema) }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('graphics'),
    slice: z.array(GraphicSchema),
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('instances'),
    slice: z.array(InstanceSchema),
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('eventLog'),
    slice: z.array(EventLogEntrySchema),
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

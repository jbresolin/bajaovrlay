import { z } from 'zod';

import { CommandErrorSchema } from '../commands/commandError.js';
import { DataSnapshotSchema } from '../dataSources/dataSnapshot.js';
import { DataSourceSchema } from '../dataSources/dataSource.js';
import { RecordingSchema } from '../dataSources/recording.js';
import { MacroSchema } from '../macros/macro.js';
import { MacroRunSchema } from '../macros/macroRun.js';
import { QuickFirePanelSchema } from '../quickFire/quickFirePanel.js';
import { ItemSchema } from '../rundown/item.js';
import { RundownSchema } from '../rundown/rundown.js';
import { ChangedSlicesSchema } from '../slices/changedSlices.js';
import { EventLogEntrySchema } from '../slices/eventLogEntry.js';
import { GraphicSchema } from '../slices/graphic.js';
import { InstanceSchema } from '../slices/instance.js';
import { LayerSchema } from '../slices/layer.js';
import { PreviewClearedLayerIdsSchema } from '../slices/previewClearedLayerIds.js';
import { SlicesSchema } from '../slices/slices.js';

/**
 * The server's wall clock, in whole milliseconds since 1970, at the moment a `hello` or
 * `slice` message was built (`slices` and `time` carry it too, required there). A renderer compares it with its own clock, so the race
 * clock on air counts on the server's clock (packages/shared/src/clock/serverAlignedTime.ts).
 * Deliberate: optional here although the server always sends it. Thirteen test files of
 * the control page build these messages by hand, and making the field required meant
 * editing all of them while another task was changing that app. A client that gets a
 * message without it takes no sample (it never counts as "the clocks agree"); it loses
 * nothing else, and the `time` message below brings a sample every ten seconds anyway.
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
    name: z.literal('previewClearedLayerIds'),
    slice: PreviewClearedLayerIdsSchema,
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
    name: z.literal('quickFirePanels'),
    slice: z.array(QuickFirePanelSchema),
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('macros'),
    slice: z.array(MacroSchema),
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('macroRuns'),
    slice: z.array(MacroRunSchema),
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('dataSources'),
    slice: z.array(DataSourceSchema),
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('dataSnapshots'),
    slice: z.array(DataSnapshotSchema),
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('recordings'),
    slice: z.array(RecordingSchema),
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
 * Sent to every client instead of `slice` messages when one state change changed more
 * than one slice (an accepted command changes its own slice and the event log; a routine
 * data-source poll, which is left out of the event log, its source and snapshot): the
 * changed slices, each checked by its own schema, so a client takes them in ONE step.
 * Sent one by one, "Prévia: limpar" on a previewed layer reached the preview page as
 * "preview gone, no marker yet", and the program clock was cut in for that moment.
 * `serverNowMs` is required here: this message is newer than every stand-in server.
 */
export const SlicesMessageSchema = z.object({
  type: z.literal('slices'),
  slices: ChangedSlicesSchema,
  serverNowMs: z.number().int(),
});

/** One slices message after validation. */
export type SlicesMessage = z.infer<typeof SlicesMessageSchema>;

/**
 * Sent to the client that sent a command (or an unreadable message): ok, or an error
 * with a stable code and a pt-BR message. `requestId` echoes the client's, or is null.
 */
export const CommandResultMessageSchema = z.discriminatedUnion('ok', [
  z.object({
    type: z.literal('commandResult'),
    requestId: z.string().nullable(),
    ok: z.literal(true),
    /**
     * Only in the answer to an accepted createItem: the id the server gave the new item,
     * so the item editor's "Salvar e disparar" and "Salvar e prévia" can take or preview
     * that very item next (BAJAOVRLAY-37). Left out of every other answer.
     */
    createdItemId: z.string().min(1).optional(),
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

/**
 * Sent to every client every ten seconds: what the server's wall clock shows, in whole
 * milliseconds since 1970, and nothing else. It exists so that a page keeps getting
 * samples of the server's clock while no slice is changing; without it a step of the
 * page's own clock stayed uncorrected until something changed on the server. Here
 * `serverNowMs` is required: the time is all this message has to say.
 */
export const TimeMessageSchema = z.object({
  type: z.literal('time'),
  serverNowMs: z.number().int(),
});

/** One time message after validation. */
export type TimeMessage = z.infer<typeof TimeMessageSchema>;

/** Every message the server sends, told apart by `type`. */
export const ServerMessageSchema = z.discriminatedUnion('type', [
  HelloMessageSchema,
  SliceMessageSchema,
  SlicesMessageSchema,
  CommandResultMessageSchema,
  TimeMessageSchema,
]);

/** Any server message after validation. */
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

import { z } from 'zod';

import { InstanceBindingsSchema } from '../bindings/instanceBindings.js';
import { CommandErrorSchema } from '../commands/commandError.js';
import { DataSnapshotSchema } from '../dataSources/dataSnapshot.js';
import { DataSourceSchema } from '../dataSources/dataSource.js';
import { RecordingSchema } from '../dataSources/recording.js';
import { PeopleSchema } from '../entities/person.js';
import { ScheduleSlotsSchema } from '../entities/scheduleSlot.js';
import { SponsorsSchema } from '../entities/sponsor.js';
import { TeamsSchema } from '../entities/team.js';
import { EventRulesSchema } from '../eventInbox/eventRule.js';
import { InboxEventsSchema } from '../eventInbox/inboxEventsSlice.js';
import { MacroSchema } from '../macros/macro.js';
import { MacroRunSchema } from '../macros/macroRun.js';
import { MacroStopsSchema } from '../macros/macroStop.js';
import { MediaSchema } from '../media/mediaRecord.js';
import { ObsSliceSchema } from '../obs/obsSlice.js';
import { OutputsSchema } from '../outputs/output.js';
import { OverridesSchema } from '../overrides/override.js';
import { ProgramHistorySchema } from '../programHistory/programHistory.js';
import { QuickFirePanelSchema } from '../quickFire/quickFirePanel.js';
import { ItemSchema } from '../rundown/item.js';
import { RundownSchema } from '../rundown/rundown.js';
import { ChangedSlicesSchema } from '../slices/changedSlices.js';
import { EventLogEntrySchema } from '../slices/eventLogEntry.js';
import { GraphicSchema } from '../slices/graphic.js';
import { InstanceSchema } from '../slices/instance.js';
import { LayersSchema } from '../slices/layer.js';
import { PreviewClearedLayerIdsSchema } from '../slices/previewClearedLayerIds.js';
import { SlicesSchema } from '../slices/slices.js';
import { TriggersSchema } from '../triggers/trigger.js';
import { TriggerActivitySchema } from '../triggers/triggerActivity.js';

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

/**
 * Sent once, right after a client connects: every slice, the server's clock time and the
 * build the server runs (`buildId`, the value its built pages embed; packages/shared/src/build).
 * A page loaded from another build reloads itself. `buildId` is optional: a server from
 * before this field, or one started with no build-id.json, leaves it out, and nothing is
 * compared then. A page from before this field ignores it (Zod drops unknown keys).
 */
export const HelloMessageSchema = z.object({
  type: z.literal('hello'),
  slices: SlicesSchema,
  serverNowMs: ServerNowMsSchema,
  buildId: z.string().min(1).optional(),
});

/**
 * Sent to every client when one slice changes. The `name` decides what `slice` must
 * contain, so a client can never store layers as instances. Each one carries the
 * server's clock time, as `hello` does. There is no `dataSnapshots` case: a snapshot
 * changes source by source, in the `dataSnapshot` message below.
 */
export const SliceMessageSchema = z.discriminatedUnion('name', [
  z.object({
    type: z.literal('slice'),
    name: z.literal('outputs'),
    slice: OutputsSchema,
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('layers'),
    slice: LayersSchema,
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
    name: z.literal('instanceBindings'),
    slice: InstanceBindingsSchema,
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('programHistory'),
    slice: ProgramHistorySchema,
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('overrides'),
    slice: OverridesSchema,
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
    name: z.literal('macroStops'),
    slice: MacroStopsSchema,
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('obs'),
    slice: ObsSliceSchema,
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('triggers'),
    slice: TriggersSchema,
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('triggerActivity'),
    slice: TriggerActivitySchema,
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
    name: z.literal('recordings'),
    slice: z.array(RecordingSchema),
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('events'),
    slice: InboxEventsSchema,
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('eventRules'),
    slice: EventRulesSchema,
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('teams'),
    slice: TeamsSchema,
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('people'),
    slice: PeopleSchema,
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('sponsors'),
    slice: SponsorsSchema,
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('scheduleSlots'),
    slice: ScheduleSlotsSchema,
    serverNowMs: ServerNowMsSchema,
  }),
  z.object({
    type: z.literal('slice'),
    name: z.literal('media'),
    slice: MediaSchema,
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
 * Sent to every operator connection when one source's snapshot changed: the source's new
 * last good data, or `null` when the source no longer has any (it was deleted). Only that
 * source is sent, so a 60-car poll of one source does not resend every other source's
 * snapshot (BAJAOVRLAY-40); the page merges it into its list by `sourceId`. Screen
 * connections never get it (graphics receive resolved data only). `serverNowMs` is
 * required, as on `slices`: this message is newer than every stand-in server.
 * A control page still running an older bundle drops this message without a word, which
 * is why the hello names the server's build and a page from another build reloads itself,
 * from the next upgrade on. A page opened before PR #17 has no reload code, so it needs
 * one reload by hand (README: "Pages reload themselves when the server's build changes").
 */
export const DataSnapshotMessageSchema = z
  .object({
    type: z.literal('dataSnapshot'),
    sourceId: z.string().min(1),
    snapshot: DataSnapshotSchema.nullable(),
    serverNowMs: z.number().int(),
  })
  .refine(
    (message) => message.snapshot === null || message.snapshot.sourceId === message.sourceId,
    {
      message: 'the snapshot must belong to the source the message names',
      path: ['snapshot', 'sourceId'],
    },
  );

/** One dataSnapshot message after validation. */
export type DataSnapshotMessage = z.infer<typeof DataSnapshotMessageSchema>;

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
 * Sent to every client every ten seconds: what the server clock shows, in whole
 * milliseconds since 1970. A page answers it with a `clockProbe`, so its alignment is
 * kept fresh while no slice is changing (packages/shared/src/clock/serverAlignedTime.ts).
 * `offFromRealTimeMs` (BAJAOVRLAY-62) is how far the server clock is still from real
 * time by NTP (real time minus the server clock), left out until NTP has answered and
 * when NTP is off; the control page's header warns from 2 s on.
 */
export const TimeMessageSchema = z.object({
  type: z.literal('time'),
  serverNowMs: z.number().int(),
  offFromRealTimeMs: z.number().int().optional(),
});

/** One time message after validation. */
export type TimeMessage = z.infer<typeof TimeMessageSchema>;

/**
 * Sent to one client only, the moment its `clockProbe` arrives: the probe's own
 * `pageSentAtMs` back, and the server clock at that moment. The page takes the midpoint
 * of its send and its arrival as the moment the server read its clock (BAJAOVRLAY-62).
 */
export const ClockProbeAnswerMessageSchema = z.object({
  type: z.literal('clockProbeAnswer'),
  pageSentAtMs: z.number().int(),
  serverNowMs: z.number().int(),
});

/** One clockProbeAnswer message after validation. */
export type ClockProbeAnswerMessage = z.infer<typeof ClockProbeAnswerMessageSchema>;

/** Every message the server sends, told apart by `type`. */
export const ServerMessageSchema = z.discriminatedUnion('type', [
  HelloMessageSchema,
  SliceMessageSchema,
  SlicesMessageSchema,
  DataSnapshotMessageSchema,
  CommandResultMessageSchema,
  TimeMessageSchema,
  ClockProbeAnswerMessageSchema,
]);

/** Any server message after validation. */
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

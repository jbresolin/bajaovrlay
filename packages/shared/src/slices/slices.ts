import { z } from 'zod';

import { InstanceBindingsSchema } from '../bindings/instanceBindings.js';
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
import { TriggersSchema } from '../triggers/trigger.js';
import { TriggerActivitySchema } from '../triggers/triggerActivity.js';
import { EventLogEntrySchema } from './eventLogEntry.js';
import { GraphicSchema } from './graphic.js';
import { InstanceSchema } from './instance.js';
import { LayersSchema } from './layer.js';
import { PreviewClearedLayerIdsSchema } from './previewClearedLayerIds.js';

/** The name of every slice, in the order the server lists them. */
export const SliceNameSchema = z.enum([
  'outputs',
  'layers',
  'graphics',
  'instances',
  'previewClearedLayerIds',
  'instanceBindings',
  'programHistory',
  'rundowns',
  'items',
  'quickFirePanels',
  'macros',
  'macroRuns',
  'macroStops',
  'obs',
  'triggers',
  'triggerActivity',
  'dataSources',
  'dataSnapshots',
  'overrides',
  'recordings',
  'events',
  'eventRules',
  'teams',
  'people',
  'sponsors',
  'scheduleSlots',
  'media',
  'eventLog',
]);

/** One of SliceNameSchema's values. */
export type SliceName = z.infer<typeof SliceNameSchema>;

/**
 * All the state the server owns, as named slices. Clients never hold state of their
 * own: they receive these over the WebSocket (or GET /api/v1/state) and send commands.
 */
export const SlicesSchema = z.object({
  /**
   * The renderer addresses OBS loads (BAJAOVRLAY-49): `program` always, and any the
   * operator adds on "Saídas e camadas". Saved. Screens receive it whole: it is a few
   * rows, and the schema requires `program` in it, so it could not be sent empty.
   */
  outputs: OutputsSchema,
  /** The layers of every output, each naming its own; ids unique, zIndex per output. */
  layers: LayersSchema,
  graphics: z.array(GraphicSchema),
  instances: z.array(InstanceSchema),
  /**
   * The layers Prévia shows empty because the next take will clear them ("vai limpar").
   * Kept in the server's memory only, never saved: after a restart it is empty.
   */
  previewClearedLayerIds: PreviewClearedLayerIdsSchema,
  /**
   * The bindings of each instance on air or in preview, by instance id (BAJAOVRLAY-20):
   * what the live refreshes read. Saved with the instances; screens never receive it.
   */
  instanceBindings: InstanceBindingsSchema,
  /**
   * What each layer's program output showed before its last ten changes (BAJAOVRLAY-30),
   * read by "Desfazer" and "Desfazer última". Saved, so a restart keeps it; screens never
   * receive it.
   */
  programHistory: ProgramHistorySchema,
  /** The ordered lists of items, one per session, each with its "next" cursor. */
  rundowns: z.array(RundownSchema),
  /**
   * Every prepared item of every rundown and quick-fire panel; `home` and `order` say
   * where each sits.
   */
  items: z.array(ItemSchema),
  /** The quick-fire panels (named grids of buttons), each with its tab position. */
  quickFirePanels: z.array(QuickFirePanelSchema),
  /** The macros, in the order they were created. */
  macros: z.array(MacroSchema),
  /**
   * The macro running now, if any (at most one entry). Kept in the server's memory only,
   * never saved: after a restart it is empty.
   */
  macroRuns: z.array(MacroRunSchema),
  /**
   * Where and why each macro's last run stopped at a refused step (BAJAOVRLAY-27), for
   * its button. Kept in the server's memory only, never saved: after a restart it is empty.
   */
  macroStops: MacroStopsSchema,
  /**
   * OBS as the server's one connection to it last heard (BAJAOVRLAY-27): connected or
   * not, the scenes, Program and Preview, the latest scene switch. Kept in the server's
   * memory only and refilled from OBS at every boot; screens receive it as "no OBS".
   */
  obs: ObsSliceSchema,
  /** The triggers (BAJAOVRLAY-48): what each waits for and the macro it runs. Saved. */
  triggers: TriggersSchema,
  /**
   * "Pausar gatilhos", each trigger's last firing and the newest firings, those that wait
   * for the operator among them (BAJAOVRLAY-48). Kept in the server's memory only: a boot
   * starts unpaused with no firing. Screens never receive either trigger slice.
   */
  triggerActivity: TriggerActivitySchema,
  /** The data sources the server polls for race data, with their config and health. */
  dataSources: z.array(DataSourceSchema),
  /**
   * The last good data of each source. Saved, so a restart keeps it (stale until the
   * next good poll). Renderer connections never receive it: graphics get resolved data.
   */
  dataSnapshots: z.array(DataSnapshotSchema),
  /**
   * The operator's corrections of what the sources say (BAJAOVRLAY-20), each in force
   * until it is cleared. Saved; screens never receive it.
   */
  overrides: OverridesSchema,
  /**
   * The recorded feeds a replay can play. Kept in the server's memory only and rebuilt
   * from the recordings folder at boot.
   */
  recordings: z.array(RecordingSchema),
  /**
   * The event inbox (BAJAOVRLAY-44): the newest 200 events detected in the sources' data
   * or typed by the operator, each with its status. Saved; screens never receive it.
   */
  events: InboxEventsSchema,
  /** One rule per kind of event: ask, auto or ignore, and the item that shows it. Saved. */
  eventRules: EventRulesSchema,
  /**
   * The entity library (BAJAOVRLAY-19): the teams by car number, the people, the
   * sponsors and the day's schedule, each a slice of its own so an edit of one sponsor
   * does not resend every team. Saved; screens never receive them (graphics get resolved
   * data only, rule 3).
   */
  teams: TeamsSchema,
  people: PeopleSchema,
  sponsors: SponsorsSchema,
  scheduleSlots: ScheduleSlotsSchema,
  /**
   * The images of the media store (BAJAOVRLAY-19): one record per file under
   * DATA_DIR/media, named by its SHA-256. Saved; screens never receive it (a graphic gets
   * the image's URL already resolved).
   */
  media: MediaSchema,
  /** The newest entries of the event log only; the database keeps every entry. */
  eventLog: z.array(EventLogEntrySchema),
});

/** Every slice, after validation. */
export type Slices = z.infer<typeof SlicesSchema>;

import { z } from 'zod';

import { DataSnapshotSchema } from '../dataSources/dataSnapshot.js';
import { DataSourceSchema } from '../dataSources/dataSource.js';
import { RecordingSchema } from '../dataSources/recording.js';
import { MacroSchema } from '../macros/macro.js';
import { MacroRunSchema } from '../macros/macroRun.js';
import { QuickFirePanelSchema } from '../quickFire/quickFirePanel.js';
import { ItemSchema } from '../rundown/item.js';
import { RundownSchema } from '../rundown/rundown.js';
import { EventLogEntrySchema } from './eventLogEntry.js';
import { GraphicSchema } from './graphic.js';
import { InstanceSchema } from './instance.js';
import { LayerSchema } from './layer.js';
import { PreviewClearedLayerIdsSchema } from './previewClearedLayerIds.js';

/** The name of every slice, in the order the server lists them. */
export const SliceNameSchema = z.enum([
  'layers',
  'graphics',
  'instances',
  'previewClearedLayerIds',
  'rundowns',
  'items',
  'quickFirePanels',
  'macros',
  'macroRuns',
  'dataSources',
  'dataSnapshots',
  'recordings',
  'eventLog',
]);

/** One of SliceNameSchema's values. */
export type SliceName = z.infer<typeof SliceNameSchema>;

/**
 * All the state the server owns, as named slices. Clients never hold state of their
 * own: they receive these over the WebSocket (or GET /api/v1/state) and send commands.
 */
export const SlicesSchema = z.object({
  layers: z.array(LayerSchema),
  graphics: z.array(GraphicSchema),
  instances: z.array(InstanceSchema),
  /**
   * The layers Prévia shows empty because the next take will clear them ("vai limpar").
   * Kept in the server's memory only, never saved: after a restart it is empty.
   */
  previewClearedLayerIds: PreviewClearedLayerIdsSchema,
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
  /** The data sources the server polls for race data, with their config and health. */
  dataSources: z.array(DataSourceSchema),
  /**
   * The last good data of each source. Saved, so a restart keeps it (stale until the
   * next good poll). Renderer connections never receive it: graphics get resolved data.
   */
  dataSnapshots: z.array(DataSnapshotSchema),
  /**
   * The recorded feeds a replay can play. Kept in the server's memory only and rebuilt
   * from the recordings folder at boot.
   */
  recordings: z.array(RecordingSchema),
  /** The newest entries of the event log only; the database keeps every entry. */
  eventLog: z.array(EventLogEntrySchema),
});

/** Every slice, after validation. */
export type Slices = z.infer<typeof SlicesSchema>;

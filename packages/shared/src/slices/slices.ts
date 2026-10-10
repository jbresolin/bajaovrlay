import { z } from 'zod';

import { EventLogEntrySchema } from './eventLogEntry.js';
import { GraphicSchema } from './graphic.js';
import { InstanceSchema } from './instance.js';
import { LayerSchema } from './layer.js';

/** The name of every slice, in the order the server lists them. */
export const SliceNameSchema = z.enum(['layers', 'graphics', 'instances', 'eventLog']);

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
  /** The newest entries of the event log only; the database keeps every entry. */
  eventLog: z.array(EventLogEntrySchema),
});

/** Every slice, after validation. */
export type Slices = z.infer<typeof SlicesSchema>;

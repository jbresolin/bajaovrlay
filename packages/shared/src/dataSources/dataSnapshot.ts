import { z } from 'zod';

import { BracketsShapeSchema } from '../dataShapes/bracketsShape.js';
import { PositionsShapeSchema } from '../dataShapes/positionsShape.js';
import { SessionShapeSchema } from '../dataShapes/sessionShape.js';
import { StandingsShapeSchema } from '../dataShapes/standingsShape.js';

/** The canonical shapes one good poll produced; a source produces only some of them. */
export const DataSnapshotShapesSchema = z.object({
  session: SessionShapeSchema.optional(),
  positions: PositionsShapeSchema.optional(),
  standings: StandingsShapeSchema.optional(),
  brackets: BracketsShapeSchema.optional(),
});

/** The shapes of a snapshot, each one valid. */
export type DataSnapshotShapes = z.infer<typeof DataSnapshotShapesSchema>;

/**
 * One entry of the `dataSnapshots` slice: the last good data of one source. Saved, so a
 * restart keeps it (marked stale until the next good poll; rule 4). Renderers never
 * receive this slice: graphics get resolved data only.
 */
export const DataSnapshotSchema = z.object({
  sourceId: z.string().min(1),
  /** When the poll that produced these shapes was made. */
  receivedAtMs: z.number().int(),
  shapes: DataSnapshotShapesSchema,
});

/** A snapshot that has passed DataSnapshotSchema. */
export type DataSnapshot = z.infer<typeof DataSnapshotSchema>;

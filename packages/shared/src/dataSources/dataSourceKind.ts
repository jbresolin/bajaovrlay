import { z } from 'zod';

/**
 * The kinds of data source the server can poll: the race simulator, and a replay of a
 * recorded feed. Each kind has its own config schema (simulatorConfig.ts, replayConfig.ts)
 * and its own adapter on the server.
 */
export const DataSourceKindSchema = z.enum(['simulator', 'replay']);

/** One kind of data source. */
export type DataSourceKind = z.infer<typeof DataSourceKindSchema>;

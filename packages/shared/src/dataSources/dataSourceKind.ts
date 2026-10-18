import { z } from 'zod';

/**
 * The kinds of data source the server can poll: the race simulator, a replay of a
 * recorded feed, and a flex HTTP/JSON source (any JSON API, mapped by its config). Each
 * kind has its own config schema (simulatorConfig.ts, replayConfig.ts, httpJsonConfig.ts)
 * and its own adapter on the server.
 */
export const DataSourceKindSchema = z.enum(['simulator', 'replay', 'httpJson']);

/** One kind of data source. */
export type DataSourceKind = z.infer<typeof DataSourceKindSchema>;

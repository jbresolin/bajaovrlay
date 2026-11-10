import { z } from 'zod';

/**
 * The kinds of data source the server can poll: the race simulator, a replay of a
 * recorded feed, a flex HTTP/JSON source (any JSON API, mapped by its config), and a
 * YouTube live's chat, read for its Super Chats (BAJAOVRLAY-35). Each kind has its own
 * config schema (simulatorConfig.ts, replayConfig.ts, httpJsonConfig.ts,
 * youtubeLiveChatConfig.ts) and its own adapter on the server.
 */
export const DataSourceKindSchema = z.enum(['simulator', 'replay', 'httpJson', 'youtubeLiveChat']);

/** One kind of data source. */
export type DataSourceKind = z.infer<typeof DataSourceKindSchema>;

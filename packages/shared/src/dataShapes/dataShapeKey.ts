import { z } from 'zod';

/**
 * The six canonical shapes a data source can produce. Every source maps its own data
 * into these, and graphics bind only to them. `incidents` (BAJAOVRLAY-44) is what the
 * event inbox watches for penalties; `superChats` (BAJAOVRLAY-35) what it watches for a
 * viewer's paid message, which only the YouTube source produces and no graphic binds to.
 */
export const DataShapeKeySchema = z.enum([
  'session',
  'positions',
  'standings',
  'brackets',
  'incidents',
  'superChats',
]);

/** One of the six canonical shape names. */
export type DataShapeKey = z.infer<typeof DataShapeKeySchema>;

/**
 * The kind of competition a session is. The Baja SAE dynamic events plus `other`, for a
 * session that is none of them (a demonstration, a test run).
 */
export const SessionKindSchema = z.enum([
  'enduro',
  'acceleration',
  'speed',
  'traction',
  'suspension',
  'maneuverability',
  'other',
]);

/** One kind of session. */
export type SessionKind = z.infer<typeof SessionKindSchema>;

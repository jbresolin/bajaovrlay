import { z } from 'zod';

/**
 * The four canonical shapes a data source can produce. Every source maps its own data
 * into these, and graphics bind only to them.
 */
export const DataShapeKeySchema = z.enum(['session', 'positions', 'standings', 'brackets']);

/** One of the four canonical shape names. */
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

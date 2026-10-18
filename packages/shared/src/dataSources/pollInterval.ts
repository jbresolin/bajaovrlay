import { z } from 'zod';

/**
 * How often a source is polled: from twice a second (faster would hammer the source) to
 * once a minute (slower is not live data any more). Used by the slice and the commands.
 */
export const PollIntervalMsSchema = z.number().int().min(500).max(60_000);

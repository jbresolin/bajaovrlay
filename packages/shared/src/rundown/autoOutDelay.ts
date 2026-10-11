import { z } from 'zod';

/**
 * How long an item stays on air before the server clears its layer by itself, in whole
 * milliseconds. It is always more than zero: "stay until cleared" is said by having no
 * delay at all, never by zero, because zero would clear the layer the instant it is taken.
 */
export const AutoOutDelayMsSchema = z.number().int().positive();

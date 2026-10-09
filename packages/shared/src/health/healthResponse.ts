import { z } from 'zod';

/**
 * The body of `GET /health`: the server is up (`ok: true`) and which version runs.
 * The server builds its answer from this schema; the control page checks replies with it.
 */
export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  version: z.string().min(1),
});

/** A health answer that has passed HealthResponseSchema. */
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

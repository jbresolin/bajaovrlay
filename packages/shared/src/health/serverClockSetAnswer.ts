import { z } from 'zod';

/**
 * The answer of `POST /api/v1/server-clock/set-now` ("Acertar relógio agora",
 * BAJAOVRLAY-62): by how many ms the server clock was stepped to real time (positive:
 * forwards). The control page says so under the menu.
 */
export const ServerClockSetAnswerSchema = z.object({
  steppedByMs: z.number().int(),
});

/** An answer that has passed ServerClockSetAnswerSchema. */
export type ServerClockSetAnswer = z.infer<typeof ServerClockSetAnswerSchema>;

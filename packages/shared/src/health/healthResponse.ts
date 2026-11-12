import { z } from 'zod';

import { ServerClockSourceSchema } from './serverClockSource.js';

/**
 * What the server says about its clock (BAJAOVRLAY-62), for "Verificar servidor": NTP
 * off, or on with its last NTP answer (null until one came) and how far the server clock
 * is still from real time (real time minus the server clock, in ms; null until an
 * answer). `source` (BAJAOVRLAY-76) says what the clock follows now: NTP, HTTPS Date
 * headers while NTP is quiet, or nothing; a server from before it leaves it out.
 */
export const ServerClockHealthSchema = z.discriminatedUnion('isNtpOn', [
  z.object({ isNtpOn: z.literal(false) }),
  z.object({
    isNtpOn: z.literal(true),
    lastNtpAnswer: z
      .object({
        serverName: z.string().min(1),
        /** Real time when the answer arrived, in ms since 1970. */
        atMs: z.number().int(),
        /** Real time minus the server clock at that answer, in ms. */
        differenceMs: z.number().int(),
        roundTripMs: z.number().int().min(0),
      })
      .nullable(),
    offFromRealTimeMs: z.number().int().nullable(),
    source: ServerClockSourceSchema.optional(),
  }),
]);

/** A server clock report that has passed ServerClockHealthSchema. */
export type ServerClockHealth = z.infer<typeof ServerClockHealthSchema>;

/**
 * The body of `GET /health`: the server is up (`ok: true`) and which version runs.
 * The server builds its answer from this schema; the control page checks replies with it.
 * `serverClock` is optional: a server from before BAJAOVRLAY-62 leaves it out.
 */
export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  version: z.string().min(1),
  serverClock: ServerClockHealthSchema.optional(),
});

/** A health answer that has passed HealthResponseSchema. */
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

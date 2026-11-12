import { z } from 'zod';

/**
 * The last answer the server clock took (BAJAOVRLAY-76): from NTP, or from the Date
 * headers of HTTPS servers when NTP is quiet; which server; when it arrived (real time,
 * ms since 1970); and real time minus the server clock at that moment, in ms.
 */
export const ServerClockLastAnswerSchema = z.object({
  source: z.enum(['ntp', 'https']),
  /** As the operator reads it: `a.st1.ntp.br`, `www.cloudflare.com`. */
  serverName: z.string().min(1),
  atMs: z.number().int(),
  differenceMs: z.number().int(),
});

/** One last answer that has passed ServerClockLastAnswerSchema. */
export type ServerClockLastAnswer = z.infer<typeof ServerClockLastAnswerSchema>;

/**
 * Which source the server clock follows now, for the header's menu and "Verificar
 * servidor": NTP, HTTPS (NTP quiet for a full poll interval), or none (the computer's own
 * clock, running on at its last rate). Following a source, `lastAnswer` is that source's;
 * following none, it is the last answer of either, or null when none ever came.
 */
export const ServerClockSourceSchema = z.discriminatedUnion('following', [
  z.object({ following: z.literal('ntp'), lastAnswer: ServerClockLastAnswerSchema }),
  z.object({ following: z.literal('https'), lastAnswer: ServerClockLastAnswerSchema }),
  z.object({ following: z.literal('none'), lastAnswer: ServerClockLastAnswerSchema.nullable() }),
]);

/** A server clock source that has passed ServerClockSourceSchema. */
export type ServerClockSource = z.infer<typeof ServerClockSourceSchema>;

// What the server answers to "Buscar da fonte" on the flex source form: the route
// POST /api/v1/data-sources/http-json/sample-request takes one request of a flex source
// (HttpJsonRequestSchema, the same schema a saved config's requests pass) and answers
// with the parsed JSON it fetched, or with the pt-BR error a poll would have given.
import { z } from 'zod';

/**
 * The sample answer. `ok: false` is still a 200 of the route: the route did its job, and
 * the source is what failed, with the same sentence the poll error would show
 * ("A fonte respondeu 503 (Service Unavailable) em classificacao").
 */
export const HttpJsonSampleAnswerSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    /** The HTTP status the source answered with (always 2xx here). */
    status: z.number().int(),
    /** The response parsed as JSON, exactly as the mapping will read it. */
    body: z.unknown(),
  }),
  z.object({
    ok: z.literal(false),
    /** The pt-BR reason, naming the request and at most the host; never a header value. */
    error: z.string(),
    /**
     * When the source answered outside 2xx: its status, and its body when that was JSON
     * (within the poll's cap), so a page can tell one refusal from another, as the Baja
     * app's `{"code": "wrong_type"}` tells a tournament asked as a table (gate 2 of PR #38).
     */
    answerOutside2xx: z
      .object({ status: z.number().int(), body: z.unknown().optional() })
      .optional(),
  }),
]);

/** The sample answer as a TypeScript type. */
export type HttpJsonSampleAnswer = z.infer<typeof HttpJsonSampleAnswerSchema>;

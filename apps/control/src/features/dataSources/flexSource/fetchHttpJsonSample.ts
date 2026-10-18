import { type HttpJsonSampleAnswer, HttpJsonSampleAnswerSchema } from '@bajaovrlay/shared';
import { z } from 'zod';

import { ptBR } from '@/i18n/ptBR';

/** The address of the sample route, on the page's own server. */
export const httpJsonSampleRequestAddress = '/api/v1/data-sources/http-json/sample-request';

// The body of a refusal of the route (400): its pt-BR sentence is shown as it is.
const RouteRefusalBodySchema = z.object({ error: z.object({ message: z.string() }) });

/**
 * "Buscar da fonte": asks the server to fetch one request of the form once and answers
 * what it got, the parsed JSON or the pt-BR error a poll would show. The server makes the
 * fetch (it reads the BAJAOVRLAY_SOURCE_ variables, so a token never reaches the page),
 * and it sends no command: nothing is saved. Never throws: a request the server refused
 * answers with its reason, and a server the page cannot reach with the catalog's sentence.
 */
export async function fetchHttpJsonSample(request: unknown): Promise<HttpJsonSampleAnswer> {
  const serverUnreachable = ptBR.dataSources.flexForm.test.serverUnreachable;
  try {
    const response = await fetch(httpJsonSampleRequestAddress, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    const body: unknown = await response.json();
    if (response.ok) {
      return HttpJsonSampleAnswerSchema.parse(body);
    }
    const refusal = RouteRefusalBodySchema.safeParse(body);
    return { ok: false, error: refusal.success ? refusal.data.error.message : serverUnreachable };
  } catch {
    // No answer, or an answer that is not the route's: the server is down or not ours.
    return { ok: false, error: serverUnreachable };
  }
}

import { ServerClockSetAnswerSchema } from '@bajaovrlay/shared';
import { z } from 'zod';

/** What "Acertar agora" got: the step, the server's pt-BR reason, or no server at all. */
export type ServerClockSetOutcome =
  | { kind: 'set'; steppedByMs: number }
  | { kind: 'refused'; message: string }
  | { kind: 'unreachable' };

// The error shape every refusal of the server has; only its sentence is shown.
const RefusalAnswerSchema = z.object({ error: z.object({ message: z.string().min(1) }) });

/**
 * Asks `POST /api/v1/server-clock/set-now` (BAJAOVRLAY-62): the server asks NTP and steps
 * its clock to real time. Never throws: a refusal (503 NTP off or no answer, 403 for
 * Dados) comes back with the server's sentence, a network failure as unreachable.
 */
export async function postServerClockSetNow(): Promise<ServerClockSetOutcome> {
  let response: Response;
  try {
    response = await fetch('/api/v1/server-clock/set-now', { method: 'POST' });
  } catch {
    return { kind: 'unreachable' };
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (response.ok) {
    const answer = ServerClockSetAnswerSchema.safeParse(body);
    return answer.success
      ? { kind: 'set', steppedByMs: answer.data.steppedByMs }
      : { kind: 'unreachable' };
  }
  const refusal = RefusalAnswerSchema.safeParse(body);
  return refusal.success
    ? { kind: 'refused', message: refusal.data.error.message }
    : { kind: 'unreachable' };
}

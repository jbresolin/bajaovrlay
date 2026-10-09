import { type HealthResponse, HealthResponseSchema } from '@bajaovrlay/shared';

/**
 * Asks the server `GET /health` and returns the answer after checking it against the
 * shared schema. Throws when the server cannot be reached or answers something else.
 */
export async function fetchServerHealth(): Promise<HealthResponse> {
  const response = await fetch('/health');
  if (!response.ok) {
    throw new Error(`GET /health answered ${response.status}`);
  }
  const body: unknown = await response.json();
  return HealthResponseSchema.parse(body);
}

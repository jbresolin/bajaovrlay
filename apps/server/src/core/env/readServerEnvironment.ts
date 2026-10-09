import { z } from 'zod';

import { serverLogLevels } from '../logger/createLogger.js';

// Defaults match .env.example, which documents every variable.
const ServerEnvironmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  HOST: z.string().min(1).default('127.0.0.1'),
  LOG_LEVEL: z.enum(serverLogLevels).default('info'),
});

/** The server's settings after validation, with defaults filled in. */
export type ServerEnvironment = z.infer<typeof ServerEnvironmentSchema>;

/**
 * Reads and validates the server's environment variables. Throws with a message naming
 * the bad variable, so a typo in `.env` stops the boot instead of running half-configured.
 */
export function readServerEnvironment(
  environmentVariables: Record<string, string | undefined>,
): ServerEnvironment {
  const result = ServerEnvironmentSchema.safeParse(environmentVariables);
  if (!result.success) {
    throw new Error(`Invalid server environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

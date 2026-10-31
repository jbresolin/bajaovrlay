import { z } from 'zod';

import { parseSourceHostAllowlist } from '../../modules/dataSources/index.js';
import { parseApiTokens } from '../apiAccess/apiTokens.js';
import { serverLogLevels } from '../logger/createLogger.js';

// Defaults match .env.example, which documents every variable.
const ServerEnvironmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  HOST: z.string().min(1).default('127.0.0.1'),
  LOG_LEVEL: z.enum(serverLogLevels).default('info'),
  // Relative paths are read from the repository root (see resolveDatabasePath.ts).
  DATABASE_PATH: z.string().min(1).default('apps/server/data/bajaovrlay.sqlite'),
  // The server's other files (data-source recordings); relative paths as above (see
  // resolveDataFolder.ts). DATABASE_PATH stays its own setting, not derived from this.
  DATA_DIR: z.string().min(1).default('apps/server/data'),
  // The hosts a flex source may fetch, read here into its parsed list (so the field holds
  // a SourceHostAllowlist, not the text): unset or empty is no list, and an entry that is
  // not a host or host:port stops the boot naming it, since a typo there would otherwise
  // refuse the timing system at every poll.
  BAJAOVRLAY_SOURCE_ALLOWED_HOSTS: z
    .string()
    .optional()
    .transform((text, context) => {
      const parsing = parseSourceHostAllowlist(text);
      if (!parsing.isValid) {
        context.addIssue({
          code: 'custom',
          message: `"${parsing.badEntry}" is not a host or host:port (write it as cronometragem.local or cronometragem.local:8080)`,
        });
        return z.NEVER;
      }
      return parsing.allowlist;
    }),
  // The devices that may send commands over HTTP (BAJAOVRLAY-28), read here into their
  // parsed list: unset or blank is the command API off, and an entry that cannot be used
  // stops the boot. The message names the device or the entry's position, never a token,
  // since the boot error is printed to the server's log.
  BAJAOVRLAY_API_TOKENS: z
    .string()
    .optional()
    .transform((text, context) => {
      const parsing = parseApiTokens(text);
      if (!parsing.isValid) {
        context.addIssue({ code: 'custom', message: parsing.problem });
        return z.NEVER;
      }
      return parsing.apiTokens;
    }),
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

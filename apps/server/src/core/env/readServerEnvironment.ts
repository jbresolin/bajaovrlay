import { z } from 'zod';

import {
  parseSourceHostAllowlist,
  parseYouTubeDailyUnitsBudget,
} from '../../modules/dataSources/index.js';
import { parsePublicOrigins } from '../../modules/media/index.js';
import { parseApiTokens } from '../apiAccess/apiTokens.js';
import { serverLogLevels } from '../logger/createLogger.js';
import { parseOperatorPins } from '../operatorLogin/operatorPins.js';
import { parseNtpSettings } from '../time/ntpSettings.js';

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
  // How many of the YouTube key's 10 000 daily units the server may spend (BAJAOVRLAY-35):
  // unset or empty is 9 000; anything but a whole number from 1 to 10 000 stops the boot,
  // since a typo would otherwise stop the Super Chats at the first poll of race day. The
  // key itself (BAJAOVRLAY_YOUTUBE_API_KEY) is not read here: the YouTube source reads it
  // at each request, so it is never held in the settings a log line could print.
  BAJAOVRLAY_YOUTUBE_DAILY_UNITS: z
    .string()
    .optional()
    .transform((text, context) => {
      const parsing = parseYouTubeDailyUnitsBudget(text);
      if (!parsing.isValid) {
        context.addIssue({
          code: 'custom',
          message: `"${String(text)}" is not a whole number of units from 1 to 10000 (leave it empty for 9000)`,
        });
        return z.NEVER;
      }
      return parsing.dailyUnitsBudget;
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
  // The command API with no token, for a studio-only network (BAJAOVRLAY-28, item 9). Only
  // "true" opens it; unset, empty or "false" does not, and any other word ("sim", "1")
  // stops the boot, since guessing wrong would either open the API or leave buttons dead.
  BAJAOVRLAY_API_OPEN: z
    .string()
    .optional()
    .transform((text, context) => {
      if (text === undefined || text === '' || text === 'false') {
        return false;
      }
      if (text === 'true') {
        return true;
      }
      context.addIssue({
        code: 'custom',
        message: `"${text}" is not a yes or no: write true or false`,
      });
      return z.NEVER;
    }),
  // The addresses of a reverse proxy whose pages may upload images, read here into the
  // list of origins: unset or empty is none, and an entry that is not an http(s) origin
  // stops the boot naming it, since a typo would otherwise refuse every upload (403).
  BAJAOVRLAY_PUBLIC_ORIGINS: z
    .string()
    .optional()
    .transform((text, context) => {
      const parsing = parsePublicOrigins(text);
      if (!parsing.isValid) {
        context.addIssue({
          code: 'custom',
          message: `"${parsing.badEntry}" is not an address like https://bajaovrlay.casa.lan (scheme and host, nothing after them)`,
        });
        return z.NEVER;
      }
      return parsing.publicOrigins;
    }),
  // Where OBS's WebSocket server is (BAJAOVRLAY-27), as OBS 32 shows it in Tools →
  // WebSocket Server Settings. Unset or empty: OBS control is off. Anything but a ws://
  // or wss:// address stops the boot, since a wrong one would only show "erro" on race
  // day; the message quotes the address with any user and password in it masked.
  BAJAOVRLAY_OBS_URL: z
    .string()
    .optional()
    .transform((text, context) => {
      if (text === undefined || text === '') {
        return undefined;
      }
      if (!isObsWebSocketAddress(text)) {
        context.addIssue({
          code: 'custom',
          message: `"${maskTheUserAndPasswordInAnAddress(text)}" is not an obs-websocket address (write it as ws://127.0.0.1:4455)`,
        });
        return z.NEVER;
      }
      return text;
    }),
  // OBS's WebSocket password. Unset or empty: none is sent (OBS's authentication off).
  // Never checked beyond that, so no boot error can ever quote it.
  BAJAOVRLAY_OBS_PASSWORD: z
    .string()
    .optional()
    .transform((text) => (text === '' ? undefined : text)),
  // The NTP servers the server clock follows (BAJAOVRLAY-62), read here into `NtpSettings`:
  // unset or empty is NTP.br then the pool, "off" turns NTP off, and an entry that is not
  // a host or host:port stops the boot naming it, since a typo would leave the server on
  // the machine's own clock without a word.
  BAJAOVRLAY_NTP_SERVERS: z
    .string()
    .optional()
    .transform((text, context) => {
      const parsing = parseNtpSettings(text);
      if (!parsing.isValid) {
        context.addIssue({
          code: 'custom',
          message: `"${parsing.badEntry}" is not an NTP server (write it as a.st1.ntp.br or 192.168.10.5:123, or "off")`,
        });
        return z.NEVER;
      }
      return parsing.ntpSettings;
    }),
  // The operator login's two PINs (BAJAOVRLAY-29), read together below: each alone means
  // nothing, so the pair is checked as one setting, `operatorPins`.
  BAJAOVRLAY_PIN_PRODUCER: z.string().optional(),
  BAJAOVRLAY_PIN_DATA: z.string().optional(),
});

// The two PINs become `operatorPins` and the raw variables are dropped from the result, so
// no later code (nor a log line that prints the environment) holds a PIN by its variable.
// Neither set: the login is off; both, valid and different: on; anything else stops the
// boot with a pt-BR reason that never quotes a PIN.
const ServerEnvironmentWithOperatorPinsSchema = ServerEnvironmentSchema.transform(
  (environment, context) => {
    const { BAJAOVRLAY_PIN_PRODUCER, BAJAOVRLAY_PIN_DATA, ...otherSettings } = environment;
    const parsing = parseOperatorPins(BAJAOVRLAY_PIN_PRODUCER, BAJAOVRLAY_PIN_DATA);
    if (!parsing.isValid) {
      context.addIssue({ code: 'custom', message: parsing.problem });
      return z.NEVER;
    }
    return { ...otherSettings, operatorPins: parsing.operatorPins };
  },
);

/** Whether a text is a ws:// or wss:// address with a host, as obs-websocket takes. */
function isObsWebSocketAddress(text: string): boolean {
  if (!URL.canParse(text)) {
    return false;
  }
  const address = new URL(text);
  const isWebSocketScheme = address.protocol === 'ws:' || address.protocol === 'wss:';
  return isWebSocketScheme && address.hostname !== '';
}

/**
 * The address with everything between "://" and the last "@" replaced by `***`, so a
 * boot error never prints a user or password written into it. A text with no "://" is
 * masked from its start: a malformed address gives no way to tell which part is secret.
 */
function maskTheUserAndPasswordInAnAddress(text: string): string {
  const positionOfTheLastAt = text.lastIndexOf('@');
  if (positionOfTheLastAt === -1) {
    return text;
  }
  const positionOfTheScheme = text.indexOf('://');
  const isTheSchemeBeforeTheAt =
    positionOfTheScheme !== -1 && positionOfTheScheme < positionOfTheLastAt;
  const keptBeginning = isTheSchemeBeforeTheAt ? text.slice(0, positionOfTheScheme + 3) : '';
  return `${keptBeginning}***${text.slice(positionOfTheLastAt)}`;
}

/** The server's settings after validation, with defaults filled in. */
export type ServerEnvironment = z.infer<typeof ServerEnvironmentWithOperatorPinsSchema>;

/**
 * Reads and validates the server's environment variables. Throws with a message naming
 * the bad variable, so a typo in `.env` stops the boot instead of running half-configured.
 */
export function readServerEnvironment(
  environmentVariables: Record<string, string | undefined>,
): ServerEnvironment {
  const result = ServerEnvironmentWithOperatorPinsSchema.safeParse(environmentVariables);
  if (!result.success) {
    throw new Error(`Invalid server environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

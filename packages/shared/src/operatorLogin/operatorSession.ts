import { z } from 'zod';

import { OperatorRoleSchema } from './operatorRole.js';

/** The longest station name the login takes ("Mesa 1", "Cabine de dados"). */
export const longestStationNameLength = 30;

// Letters of any language (accents too), digits, the space and - . _ ( ) #: enough for
// "Mesa #2" or "Cabine Técnica (fundos)". It goes into the actor, the event log and the
// page, so no colon (the actor's separator), markup, control characters or emoji
// (gate 2 of PR #51).
const stationNameCharacters = /^[\p{L}\p{N} ._()#-]*$/u;

/**
 * The name of the operator's station, typed at login and shown after the role ("Produtor
 * · Mesa 1"). Trimmed; 1 to 30 characters, of letters, digits, spaces and - . _ ( ) #. It
 * names a place, not a person: there are no per-user accounts.
 */
export const StationNameSchema = z
  .string()
  .trim()
  .min(1, 'Digite o nome da estação (por exemplo, Mesa 1).')
  .max(
    longestStationNameLength,
    `O nome da estação tem no máximo ${String(longestStationNameLength)} letras.`,
  )
  .regex(
    stationNameCharacters,
    'O nome da estação só pode ter letras, números, espaços e - . _ ( ) #.',
  );

/**
 * The body of POST /api/v1/session, the login: the role, its PIN and the station. The PIN
 * is checked by the server only; its shape is not checked here, so a PIN of the wrong
 * shape is simply a wrong PIN and counts towards the lockout like any other.
 */
export const LoginRequestSchema = z.object({
  role: OperatorRoleSchema,
  pin: z.string().max(64),
  station: StationNameSchema,
});

/** The login body after validation. */
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** Who is logged in: the role, the station, and when the session ends (ISO 8601). */
export const OperatorSessionSchema = z.object({
  role: OperatorRoleSchema,
  station: z.string(),
  expiresAt: z.iso.datetime(),
});

/** One logged-in session as the page reads it. */
export type OperatorSession = z.infer<typeof OperatorSessionSchema>;

/**
 * The answer of GET /api/v1/session (and of a successful login): whether this server asks
 * for a login at all (false while no PINs are set, the page then open as before), and the
 * caller's session, or null when it has none.
 */
export const SessionAnswerSchema = z.object({
  isLoginRequired: z.boolean(),
  session: OperatorSessionSchema.nullable(),
});

/** GET /api/v1/session's answer after validation. */
export type SessionAnswer = z.infer<typeof SessionAnswerSchema>;

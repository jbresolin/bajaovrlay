import { z } from 'zod';

/**
 * The two roles an operator logs in with on the studio LAN (BAJAOVRLAY-29): `produtor`
 * runs the show and may send every operator command; `dados` prepares it and never
 * changes what is on program or preview. Spelt in pt-BR because the role is the first
 * part of the actor the event log shows (`produtor:Mesa 1`).
 */
export const OperatorRoleSchema = z.enum(['produtor', 'dados']);

/** One of OperatorRoleSchema's values. */
export type OperatorRole = z.infer<typeof OperatorRoleSchema>;

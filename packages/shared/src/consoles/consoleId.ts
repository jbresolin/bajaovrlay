import { z } from 'zod';

/**
 * The id of one console: one tab of the control page (BAJAOVRLAY-69). The server hands it
 * out in the tab's first `hello`; the tab keeps it in sessionStorage and names it again in
 * the address of every later connection (`/ws?console=<id>`), so a reload or a reconnect of
 * that tab is the same console, and a second tab is another one. Letters, digits and
 * hyphens, 8 to 64 of them: the server's own ids are UUIDs, and a page that sends anything
 * else is handed a new id rather than refused.
 * What could go wrong: a browser's "Duplicate tab" copies sessionStorage, so the copy starts
 * as the same console until it is reloaded in a fresh tab. Two consoles taken for one are
 * never refused against each other, which is today's behaviour, never a wrong refusal.
 */
export const ConsoleIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9-]{8,64}$/, 'a console id is 8 to 64 letters, digits or hyphens');

/** A console id that has passed ConsoleIdSchema. */
export type ConsoleId = z.infer<typeof ConsoleIdSchema>;

// The commands of the match focus (BAJAOVRLAY-65). Both are the Produtor's: the bug on air
// changes as soon as "agora" does (commandSenders.ts says why Dados may not send them).
// Each names the session the operator saw, so a choice made on a page that had not yet
// heard of a new session is refused instead of landing on a match of another day.
import { z } from 'zod';

import { BracketMatchSlotSchema } from './bracketMatchFocus.js';

/**
 * Puts a match in one slot ("agora" or "a seguir"), or empties it with `matchId: null`.
 * Any match of the session may go in either slot, one listed after a match not yet run
 * included. A match already in the other slot moves: that slot is emptied. Refused when
 * the source is unknown, sends no brackets, sends another session now, or does not list
 * the match as a raced one (a bye is not).
 */
export const SetBracketMatchFocusCommandSchema = z.object({
  type: z.literal('setBracketMatchFocus'),
  sourceId: z.string().min(1),
  sessionId: z.string().min(1),
  slot: BracketMatchSlotSchema,
  /** The match's `matchId`, or null to empty the slot. */
  matchId: z.string().min(1).nullable(),
});

/** A setBracketMatchFocus command after validation. */
export type SetBracketMatchFocusCommand = z.infer<typeof SetBracketMatchFocusCommandSchema>;

/**
 * "Usar sugestão": "agora" and "a seguir" become the proposal (proposeBracketMatches: the
 * Produtor's "a seguir" moved up first, else the play-order suggestion), worked out by the
 * server from the brackets it holds when the command arrives. The page names the
 * proposal it showed, and the server refuses when its own differs, so a press never puts
 * on air a match the Produtor did not see. Refused for the same reasons as
 * setBracketMatchFocus, and when nothing is left to suggest.
 */
export const AcceptSuggestedBracketMatchesCommandSchema = z.object({
  type: z.literal('acceptSuggestedBracketMatches'),
  sourceId: z.string().min(1),
  sessionId: z.string().min(1),
  /** The match the page proposed for "agora". */
  currentMatchId: z.string().min(1),
  /** The match the page proposed for "a seguir", or null when it proposed nothing there. */
  upNextMatchId: z.string().min(1).nullable(),
});

/** An acceptSuggestedBracketMatches command after validation. */
export type AcceptSuggestedBracketMatchesCommand = z.infer<
  typeof AcceptSuggestedBracketMatchesCommandSchema
>;

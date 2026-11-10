// Everything about the match focus (which match of a Super Prime is "agora" and which "a
// seguir", BAJAOVRLAY-65) that @bajaovrlay/shared exports. The package's own index.ts
// re-exports this file with one line; other packages import from '@bajaovrlay/shared'.

// The slice: one focus per source, its session, the match in each slot; the two slots.
export {
  type BracketMatchFocus,
  type BracketMatchFocuses,
  BracketMatchFocusesSchema,
  BracketMatchFocusSchema,
  type BracketMatchSlot,
  BracketMatchSlotSchema,
} from './bracketMatchFocus.js';
// The two commands: put a match in a slot (or empty it), and "Usar sugestão".
export {
  type AcceptSuggestedBracketMatchesCommand,
  AcceptSuggestedBracketMatchesCommandSchema,
  type SetBracketMatchFocusCommand,
  SetBracketMatchFocusCommandSchema,
} from './bracketMatchFocusCommands.js';
// The raced matches in the source's order, with their round, and how far each has got.
export {
  type BracketMatchInPlayOrder,
  type BracketMatchProgress,
  listBracketMatchesInPlayOrder,
  readBracketMatchProgress,
} from './bracketMatchPlayOrder.js';
// The suggested "agora" and "a seguir": the first two matches without a winner.
export { suggestBracketMatches, type SuggestedBracketMatches } from './bracketMatchSuggestions.js';
// What "Usar sugestão" puts in the two slots: the operator's "a seguir" moved up first.
export { proposeBracketMatches } from './bracketMatchProposal.js';
// What a slot holds now (chosen, not chosen, gone) and the data the graphics receive of it.
export {
  describeFocusedMatchForGraphics,
  findBracketMatchFocusOfSource,
  type FocusedBracketCar,
  type FocusedBracketMatchData,
  type FocusedBracketMatchReading,
  readFocusedBracketMatch,
  readMatchIdOfSlot,
} from './focusedBracketMatch.js';

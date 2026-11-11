// Public surface of the match focus module (BAJAOVRLAY-65). Core imports from here, never
// from the files inside.

// Sends each match focus command (setBracketMatchFocus, acceptSuggestedBracketMatches) to
// its reducer; core's reduceCommand calls it.
export {
  type BracketMatchFocusCommand,
  reduceBracketMatchFocusCommand,
} from './reducers/reduceBracketMatchFocusCommand.js';

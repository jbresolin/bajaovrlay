import type { Command } from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { reduceAcceptSuggestedBracketMatches } from './acceptSuggestedBracketMatches.js';
import { reduceSetBracketMatchFocus } from './setBracketMatchFocus.js';

/** The commands of the match focus module, one reducer file each. */
export type BracketMatchFocusCommand = Extract<
  Command,
  { type: 'setBracketMatchFocus' | 'acceptSuggestedBracketMatches' }
>;

/** Sends a match focus command to its reducer; core's reduceCommand calls this. */
export function reduceBracketMatchFocusCommand(
  slices: SlicesChangedByCommands,
  command: BracketMatchFocusCommand,
): ReducerOutcome {
  switch (command.type) {
    case 'setBracketMatchFocus':
      return reduceSetBracketMatchFocus(slices, command);
    case 'acceptSuggestedBracketMatches':
      return reduceAcceptSuggestedBracketMatches(slices, command);
  }
}

// The history sentences of the match focus of a Super Prime (BAJAOVRLAY-65), in the group
// "Tomadas e limpezas": the match bug on air follows "agora". Named by the match's id, not
// its teams: the names come from the slices as they are now, which do not keep the
// brackets of the moment, and the match may have left the source since.
import { ptBRDataShapes } from '../dataShapes/ptBRDataShapes.js';
import type { CommandOfType } from './commandOfType.js';
import type { EventLogNames } from './eventLogNames.js';
import { nameDataSource } from './namesInSentences.js';
import { ptBREventLogReading } from './ptBREventLogReading.js';

const sentences = ptBREventLogReading.bracketMatchFocus;
const slotNames = ptBRDataShapes.bracketMatchFocusLabels.slotNames;

/** setBracketMatchFocus: a match put in "agora" or "a seguir", or that slot emptied. */
export function describeSetBracketMatchFocus(
  command: CommandOfType<'setBracketMatchFocus'>,
  names: EventLogNames,
): string {
  const sourceName = nameDataSource(command.sourceId, names);
  const slotName = slotNames[command.slot];
  if (command.matchId === null) {
    return sentences.emptiedSlot(slotName, sourceName);
  }
  return sentences.choseMatch(command.matchId, slotName, sourceName);
}

/** acceptSuggestedBracketMatches: "Usar sugestão". */
export function describeAcceptSuggestedBracketMatches(
  command: CommandOfType<'acceptSuggestedBracketMatches'>,
  names: EventLogNames,
): string {
  return sentences.acceptedSuggestion(
    slotNames.current,
    slotNames.upNext,
    nameDataSource(command.sourceId, names),
  );
}

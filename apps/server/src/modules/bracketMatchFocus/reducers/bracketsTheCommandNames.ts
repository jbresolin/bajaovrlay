import type { BracketsShape, CommandError } from '@bajaovrlay/shared';

import { ptBR } from '../../../core/messages/ptBR.js';
import type { SlicesChangedByCommands } from '../../../core/store/reducers/reducerTypes.js';

/** The brackets a match focus command may act on, or why it may not act at all. */
export type BracketsOfTheCommand =
  { isUsable: true; brackets: BracketsShape } | { isUsable: false; error: CommandError };

/**
 * The checks both commands of the match focus share, in this order: the source exists
 * (DATA_SOURCE_NOT_FOUND), it sends brackets now (BRACKETS_NOT_SENT), and they are of
 * the session the page chose in (BRACKET_SESSION_CHANGED): a page that had not yet heard
 * of a new session must never land its choice on a match of another day. A stale
 * snapshot is used as it is: staleness is a badge, never a refusal (concept §5.4).
 */
export function readBracketsTheCommandNames(
  slices: SlicesChangedByCommands,
  sourceId: string,
  sessionId: string,
): BracketsOfTheCommand {
  const dataSource = slices.dataSources.find((candidate) => candidate.id === sourceId);
  if (dataSource === undefined) {
    return {
      isUsable: false,
      error: {
        code: 'DATA_SOURCE_NOT_FOUND',
        message: ptBR.dataSourceErrors.dataSourceNotFound(sourceId),
      },
    };
  }
  const snapshot = slices.dataSnapshots.find((candidate) => candidate.sourceId === sourceId);
  // The snapshot holds brackets that passed BracketsShapeSchema when they were recorded.
  const brackets = snapshot?.shapes.brackets as BracketsShape | undefined;
  if (brackets === undefined) {
    return {
      isUsable: false,
      error: {
        code: 'BRACKETS_NOT_SENT',
        message: ptBR.bracketMatchFocus.bracketsNotSent(dataSource.label),
      },
    };
  }
  if (brackets.sessionId !== sessionId) {
    return {
      isUsable: false,
      error: {
        code: 'BRACKET_SESSION_CHANGED',
        message: ptBR.bracketMatchFocus.sessionChanged(brackets.sessionId),
      },
    };
  }
  return { isUsable: true, brackets };
}

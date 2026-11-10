/**
 * What "Partidas da chave" shows for each source that sends a Super Prime (BAJAOVRLAY-65):
 * the match "agora" and the match "a seguir", every match to choose from in play order
 * with its progress and the proposed ones marked, and the proposal of the next match once
 * "agora" has its winner or has left the source. Read from the slices with the shared rules
 * (packages/shared/src/bracketMatchFocus), so the page shows what the server reads: the
 * same play order, the same proposal (the Produtor's "a seguir" first), the same "gone".
 * Pure.
 *
 * Deliberate: nothing here moves the focus. The proposal is words and a button; "agora"
 * changes only when the Produtor presses it.
 */
import {
  type BracketMatchFocus,
  type BracketMatchInPlayOrder,
  type BracketMatchProgress,
  type BracketMatchSlot,
  type BracketsShape,
  type DataSnapshot,
  type DataSource,
  findBracketMatchFocusOfSource,
  listBracketMatchesInPlayOrder,
  proposeBracketMatches,
  readBracketMatchProgress,
  readFocusedBracketMatch,
  type SuggestedBracketMatches,
} from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

/** One match of the list, as the page shows it. */
export type MatchRow = {
  matchId: string;
  /** "Pequi × Acauã (Quartas de final)": the short names and the round. */
  matchText: string;
  progress: BracketMatchProgress;
  /** The slot "Usar sugestão" would put it in, if any. */
  suggestedFor: BracketMatchSlot | undefined;
};

/** What one slot holds on the page: a match, nothing, or a match that left the source. */
export type SlotOnThePage =
  { kind: 'chosen'; match: MatchRow } | { kind: 'empty' } | { kind: 'gone'; matchId: string };

/**
 * What the page proposes: once "agora" has its winner, the winner and the proposed next
 * match (none after the last); with "agora" empty, or gone from the source, the proposal.
 */
export type MatchFocusProposal =
  | { kind: 'currentDecided'; winnerName: string; suggestedMatchText: string | undefined }
  | { kind: 'nothingChosen'; suggestedMatchText: string }
  | { kind: 'currentGone'; suggestedMatchText: string };

/** Everything "Partidas da chave" shows for one source. */
export type MatchFocusOfASource = {
  sourceId: string;
  sourceLabel: string;
  /** The session the commands name, so a choice never lands on another day's match. */
  sessionId: string;
  current: SlotOnThePage;
  upNext: SlotOnThePage;
  proposal: MatchFocusProposal | undefined;
  /**
   * What "Usar sugestão" puts in the two slots, sent with the command so the server can
   * refuse it if its own proposal changed meanwhile; currentMatchId undefined when there
   * is nothing to propose.
   */
  proposedMatches: SuggestedBracketMatches;
  matches: MatchRow[];
};

/** The slices this reads. */
export type SlicesOfTheMatchFocus = {
  dataSources: DataSource[];
  dataSnapshots: DataSnapshot[];
  bracketMatchFocuses: BracketMatchFocus[];
};

/** "Pequi × Acauã (Quartas de final)": the two short names, then the round. */
function writeMatchText(entry: BracketMatchInPlayOrder): string {
  const carBName = entry.match.carB?.teamName ?? '';
  return ptBR.bracketMatchFocus.matchText(entry.match.carA.teamName, carBName, entry.roundName);
}

/** The short name of a match's winner, read from its cars. */
function readWinnerName(entry: BracketMatchInPlayOrder): string | undefined {
  const { carA, carB, winnerCarNumber } = entry.match;
  if (winnerCarNumber === undefined) {
    return undefined;
  }
  return winnerCarNumber === carA.carNumber ? carA.teamName : carB?.teamName;
}

/** What one slot holds, as a row of the list or an empty or gone slot. */
function readSlotOnThePage(
  brackets: BracketsShape,
  focus: BracketMatchFocus | undefined,
  slot: BracketMatchSlot,
  rows: MatchRow[],
): SlotOnThePage {
  const reading = readFocusedBracketMatch(brackets, focus, slot);
  if (reading.status === 'notChosen') {
    return { kind: 'empty' };
  }
  if (reading.status === 'gone') {
    return { kind: 'gone', matchId: reading.matchId };
  }
  const row = rows.find(
    (candidate) => candidate.matchId === reading.matchInPlayOrder.match.matchId,
  );
  return row === undefined ? { kind: 'empty' } : { kind: 'chosen', match: row };
}

/** The proposal of the page, or none while "agora" runs. */
function chooseProposal(
  brackets: BracketsShape,
  focus: BracketMatchFocus | undefined,
  proposedMatches: SuggestedBracketMatches,
  rows: MatchRow[],
): MatchFocusProposal | undefined {
  const suggestedRow = rows.find((row) => row.matchId === proposedMatches.currentMatchId);
  const reading = readFocusedBracketMatch(brackets, focus, 'current');
  if (reading.status === 'notChosen') {
    return suggestedRow === undefined
      ? undefined
      : { kind: 'nothingChosen', suggestedMatchText: suggestedRow.matchText };
  }
  if (reading.status === 'gone') {
    return suggestedRow === undefined
      ? undefined
      : { kind: 'currentGone', suggestedMatchText: suggestedRow.matchText };
  }
  const winnerName = readWinnerName(reading.matchInPlayOrder);
  if (winnerName === undefined) {
    return undefined;
  }
  return { kind: 'currentDecided', winnerName, suggestedMatchText: suggestedRow?.matchText };
}

/** Everything the panel shows for one source whose snapshot holds brackets. */
function describeOneSource(
  dataSource: DataSource,
  brackets: BracketsShape,
  focus: BracketMatchFocus | undefined,
): MatchFocusOfASource {
  // The marks follow the proposal, not the bare play order, so they always say what
  // "Usar sugestão" does (a match the Produtor put "a seguir" is marked "agora").
  const proposedMatches = proposeBracketMatches(brackets, focus);
  const rows: MatchRow[] = listBracketMatchesInPlayOrder(brackets.rounds).map((entry) => {
    const matchId = entry.match.matchId;
    let suggestedFor: BracketMatchSlot | undefined;
    if (matchId === proposedMatches.currentMatchId) {
      suggestedFor = 'current';
    } else if (matchId === proposedMatches.upNextMatchId) {
      suggestedFor = 'upNext';
    }
    return {
      matchId,
      matchText: writeMatchText(entry),
      progress: readBracketMatchProgress(entry.match),
      suggestedFor,
    };
  });
  return {
    sourceId: dataSource.id,
    sourceLabel: dataSource.label,
    sessionId: brackets.sessionId,
    current: readSlotOnThePage(brackets, focus, 'current', rows),
    upNext: readSlotOnThePage(brackets, focus, 'upNext', rows),
    proposal: chooseProposal(brackets, focus, proposedMatches, rows),
    proposedMatches,
    matches: rows,
  };
}

/**
 * What "Partidas da chave" shows, one entry per source whose last good data holds
 * brackets, in the order of the sources; none when no source sends a Super Prime.
 */
export function describeMatchFocusOfEachSource(
  slices: SlicesOfTheMatchFocus,
): MatchFocusOfASource[] {
  const sources: MatchFocusOfASource[] = [];
  for (const dataSource of slices.dataSources) {
    const snapshot = slices.dataSnapshots.find((candidate) => candidate.sourceId === dataSource.id);
    // The snapshot holds brackets that passed BracketsShapeSchema on the server.
    const brackets = snapshot?.shapes.brackets as BracketsShape | undefined;
    if (brackets === undefined) {
      continue;
    }
    const focus = findBracketMatchFocusOfSource(slices.bracketMatchFocuses, dataSource.id);
    sources.push(describeOneSource(dataSource, brackets, focus));
  }
  return sources;
}

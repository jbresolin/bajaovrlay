import { fetchHttpJsonSample } from '../flexSource/fetchHttpJsonSample';
import {
  type BajaAppTableChoice,
  type BajaAppTournamentChoice,
  isAResultOfTheOtherEndpoint,
  readBajaAppTableColumns,
  readBajaAppTableName,
  readBajaAppTournamentAnswer,
} from './bajaAppAnswerReading';
import { buildBajaAppTableRequest, buildBajaAppTournamentRequest } from './bajaAppSampleRequests';
import type { BajaAppEventAddress } from './bajaAppSourceOfChoice';

/** A result read by its id: a table with its columns, a tournament, or the pt-BR reason. */
export type BajaAppResultByIdReading =
  | {
      isRead: true;
      kind: 'table';
      table: BajaAppTableChoice;
      pointsHeader: string;
      partHeaderChoices: string[];
    }
  | { isRead: true; kind: 'tournament'; tournament: BajaAppTournamentChoice }
  | { isRead: false; reason: string };

/**
 * "Outro resultado (digite o id)" (gate 2 of PR #38): reads a result the event's menu
 * leaves out (26BR's Super Prime) by its id, through the sample route. An id says nothing
 * of its kind, so it is asked of resultado.php first; the API's 404 `wrong_type` says it
 * belongs to the other endpoint, and torneio.php is asked then. Any other failure is the
 * route's sentence. A table is never "overall" here: the overall table is in every menu.
 */
export async function readBajaAppResultById(
  where: BajaAppEventAddress,
  resultadoId: string,
): Promise<BajaAppResultByIdReading> {
  const tableRequest = buildBajaAppTableRequest(where.apiAddress, where.eventId, resultadoId);
  const tableAnswer = await fetchHttpJsonSample(tableRequest);
  if (tableAnswer.ok) {
    const columns = readBajaAppTableColumns(tableAnswer.body);
    if (!columns.isRead) {
      return { isRead: false, reason: columns.reason };
    }
    const name = readBajaAppTableName(tableAnswer.body, resultadoId);
    return {
      isRead: true,
      kind: 'table',
      table: { resultadoId, name, isTheOverallTable: false },
      pointsHeader: columns.pointsHeader,
      partHeaderChoices: columns.partHeaderChoices,
    };
  }
  if (!isAResultOfTheOtherEndpoint(tableAnswer.answerOutside2xx)) {
    return { isRead: false, reason: tableAnswer.error };
  }

  const tournamentRequest = buildBajaAppTournamentRequest(
    where.apiAddress,
    where.eventId,
    resultadoId,
  );
  const tournamentAnswer = await fetchHttpJsonSample(tournamentRequest);
  if (!tournamentAnswer.ok) {
    return { isRead: false, reason: tournamentAnswer.error };
  }
  const tournament = readBajaAppTournamentAnswer(tournamentAnswer.body);
  if (!tournament.isRead) {
    return { isRead: false, reason: tournament.reason };
  }
  return { isRead: true, kind: 'tournament', tournament: { resultadoId, name: tournament.name } };
}

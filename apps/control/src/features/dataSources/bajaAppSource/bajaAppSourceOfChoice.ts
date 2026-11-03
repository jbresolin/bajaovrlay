import {
  buildBajaAppBracketSourceConfig,
  buildBajaAppRaceSourceConfig,
  buildBajaAppResultsTableSourceConfig,
} from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

import type { FlexSourceStartingPoint } from '../flexSource/flexSourceFormValues';
import type {
  BajaAppRaceChoice,
  BajaAppTableChoice,
  BajaAppTournamentChoice,
} from './bajaAppAnswerReading';

/** What the operator chose on the picker, with what each kind needs besides. */
export type BajaAppChoice =
  | { kind: 'race'; race: BajaAppRaceChoice; acceptsSimulatedRace: boolean }
  | {
      kind: 'table';
      table: BajaAppTableChoice;
      pointsHeader: string;
      partHeaders: readonly string[];
    }
  | { kind: 'tournament'; tournament: BajaAppTournamentChoice };

/** Where the source reads: the API's address and the event read. */
export type BajaAppEventAddress = { apiAddress: string; eventId: string };

// How often each kind is read. The API caches a race for 2 s and the rest for 5 s, so
// reading faster would only fetch the same answer again.
const raceReadEveryMs = 2_000;
const tableOrTournamentReadEveryMs = 5_000;

/**
 * The new flex source a choice makes: its name ("App Baja — 26BR — Enduro"), how often it
 * is read, and its preset filled in (packages/shared, presets/bajaApp). The flex form
 * opens with it; nothing is saved until "Salvar fonte".
 */
export function buildBajaAppSourceOfChoice(
  where: BajaAppEventAddress,
  choice: BajaAppChoice,
): FlexSourceStartingPoint {
  const sourceLabel = ptBR.dataSources.bajaApp.sourceLabel;
  switch (choice.kind) {
    case 'race':
      return {
        label: sourceLabel(where.eventId, choice.race.name),
        pollIntervalMs: raceReadEveryMs,
        config: buildBajaAppRaceSourceConfig({
          ...where,
          provaId: choice.race.provaId,
          acceptsSimulatedRace: choice.acceptsSimulatedRace,
        }),
      };
    case 'table':
      return {
        label: sourceLabel(where.eventId, choice.table.name),
        pollIntervalMs: tableOrTournamentReadEveryMs,
        config: buildBajaAppResultsTableSourceConfig({
          ...where,
          resultadoId: choice.table.resultadoId,
          pointsHeader: choice.pointsHeader,
          partHeaders: choice.partHeaders,
          // The overall table adds up everything; any other is one part of the event,
          // which no scope names more closely than "other".
          standingsScope: choice.table.isTheOverallTable ? 'overall' : 'other',
        }),
      };
    case 'tournament':
      return {
        label: sourceLabel(where.eventId, choice.tournament.name),
        pollIntervalMs: tableOrTournamentReadEveryMs,
        config: buildBajaAppBracketSourceConfig({
          ...where,
          resultadoId: choice.tournament.resultadoId,
        }),
      };
  }
}

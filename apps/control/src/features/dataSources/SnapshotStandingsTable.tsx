import type { StandingsEntry, StandingsShape } from '@bajaovrlay/shared';
import { memo } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CorrectableValue } from '@/features/overrides/CorrectableValue';
import {
  type CorrectionsOfSource,
  findOverrideInLookup,
} from '@/features/overrides/overrideLookup';
import { ptBR } from '@/i18n/ptBR';

import { isTableRowTheSame } from './tableRowComparison';

const texts = ptBR.dataSources.standingsTable;
const columns = texts.columns;

// Built once: toLocaleString builds a new formatter at every call, 60 times a poll.
const pointsFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

/**
 * Writes points the Brazilian way ("646,9"); some events score fractions, so up to two
 * decimals.
 */
function formatPoints(points: number): string {
  return pointsFormat.format(points);
}

/** One correctable value of a team, or the plain value without corrections. */
function TeamValue(props: {
  entry: StandingsEntry;
  entryAsSent: StandingsEntry | undefined;
  corrections: CorrectionsOfSource | undefined;
  field: 'teamName' | 'schoolName';
}) {
  const { entry, corrections, field } = props;
  if (corrections === undefined) {
    return entry[field];
  }
  const overrideKey = {
    sourceId: corrections.sourceId,
    scope: 'car' as const,
    carNumber: entry.carNumber,
    field,
  };
  return (
    <CorrectableValue
      sourceLabel={corrections.sourceLabel}
      overrideKey={overrideKey}
      overrideInForce={findOverrideInLookup(corrections.overrideLookup, overrideKey)}
      fieldDescription={ptBR.bindings.overrides.carFieldDescription(
        columns[field],
        entry.carNumber,
      )}
      valueText={entry[field]}
      valueAsSentText={(props.entryAsSent ?? entry)[field]}
    />
  );
}

/** One team's row, memoised like the positions rows (SnapshotPositionsTable.tsx). */
const StandingsRow = memo(function StandingsRow(props: {
  entry: StandingsEntry;
  entryAsSent: StandingsEntry | undefined;
  corrections: CorrectionsOfSource | undefined;
}) {
  const { entry } = props;
  return (
    <TableRow>
      <TableCell className="tabular-nums">{entry.rank ?? texts.disqualifiedRank}</TableCell>
      <TableCell className="tabular-nums">{entry.carNumber}</TableCell>
      <TableCell>
        <TeamValue {...props} field="teamName" />
      </TableCell>
      <TableCell>
        <TeamValue {...props} field="schoolName" />
      </TableCell>
      <TableCell className="tabular-nums">{formatPoints(entry.points)}</TableCell>
    </TableRow>
  );
}, isTableRowTheSame);

/**
 * The standings of the selected source, one row per team in rank order: rank, car,
 * team, school and points; a disqualified team, which has no rank, says so in its place.
 * The table scrolls sideways in its own box on a narrow screen. With `corrections` (a
 * stored source), the standings shown are the corrected ones and a team's name and school
 * can be corrected (CorrectableValue.tsx), matched to what the source sent by car number. Points are not correctable (gate 2 of PR #18): they are the
 * organisers' result, and a wrong one is fixed at the source.
 */
export function SnapshotStandingsTable(props: {
  standings: StandingsShape;
  corrections?: CorrectionsOfSource & { standingsAsSent: StandingsShape };
}) {
  const { corrections } = props;
  const entriesAsSentByCar = new Map(
    (corrections?.standingsAsSent.entries ?? []).map((entry) => [entry.carNumber, entry]),
  );
  return (
    <Table aria-label={texts.label}>
      <TableHeader>
        <TableRow>
          <TableHead>{columns.rank}</TableHead>
          <TableHead>{columns.carNumber}</TableHead>
          <TableHead>{columns.teamName}</TableHead>
          <TableHead>{columns.schoolName}</TableHead>
          <TableHead>{columns.points}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.standings.entries.map((entry) => (
          <StandingsRow
            key={entry.carNumber}
            entry={entry}
            entryAsSent={entriesAsSentByCar.get(entry.carNumber)}
            corrections={corrections}
          />
        ))}
      </TableBody>
    </Table>
  );
}

import type { StandingsEntry, StandingsShape } from '@bajaovrlay/shared';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CorrectableValue } from '@/features/overrides/CorrectableValue';
import { ptBR } from '@/i18n/ptBR';

const texts = ptBR.dataSources.standingsTable;

/** Writes points the Brazilian way ("646,9"); some events score fractions, so up to two decimals. */
function formatPoints(points: number): string {
  return points.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

/**
 * The standings of the selected source, one row per team in rank order: rank, car,
 * team, school and points. The table scrolls sideways in its own box on a narrow screen.
 * With `corrections` (a stored source), the standings shown are the corrected ones and a
 * team's name, school and points can be corrected (CorrectableValue.tsx).
 */
export function SnapshotStandingsTable(props: {
  standings: StandingsShape;
  corrections?: { sourceId: string; sourceLabel: string; standingsAsSent: StandingsShape };
}) {
  const columns = texts.columns;
  const { corrections } = props;

  /** One correctable cell of a team, or the plain value without corrections. */
  function drawTeamValue(
    entry: StandingsEntry,
    entryAsSent: StandingsEntry | undefined,
    field: 'teamName' | 'schoolName' | 'points',
    writeValue: (team: StandingsEntry) => string,
  ) {
    if (corrections === undefined) {
      return writeValue(entry);
    }
    return (
      <CorrectableValue
        sourceLabel={corrections.sourceLabel}
        overrideKey={{
          sourceId: corrections.sourceId,
          scope: 'car',
          carNumber: entry.carNumber,
          field,
        }}
        fieldDescription={ptBR.bindings.overrides.carFieldDescription(
          columns[field],
          entry.carNumber,
        )}
        valueText={writeValue(entry)}
        valueAsSentText={writeValue(entryAsSent ?? entry)}
      />
    );
  }
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
        {props.standings.entries.map((entry, index) => {
          const entryAsSent = corrections?.standingsAsSent.entries[index];
          return (
            <TableRow key={entry.carNumber}>
              <TableCell className="tabular-nums">{entry.rank}</TableCell>
              <TableCell className="tabular-nums">{entry.carNumber}</TableCell>
              <TableCell>
                {drawTeamValue(entry, entryAsSent, 'teamName', (team) => team.teamName)}
              </TableCell>
              <TableCell>
                {drawTeamValue(entry, entryAsSent, 'schoolName', (team) => team.schoolName)}
              </TableCell>
              <TableCell className="tabular-nums">
                {drawTeamValue(entry, entryAsSent, 'points', (team) => formatPoints(team.points))}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

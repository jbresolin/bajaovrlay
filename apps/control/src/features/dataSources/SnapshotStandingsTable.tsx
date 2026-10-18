import type { StandingsShape } from '@bajaovrlay/shared';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ptBR } from '@/i18n/ptBR';

const texts = ptBR.dataSources.standingsTable;

/** Writes points the Brazilian way ("646,9"); some events score fractions, so up to two decimals. */
function formatPoints(points: number): string {
  return points.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

/**
 * The standings of the selected source, one row per team in rank order: rank, car,
 * team, school and points. The table scrolls sideways in its own box on a narrow screen.
 */
export function SnapshotStandingsTable(props: { standings: StandingsShape }) {
  const columns = texts.columns;
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
          <TableRow key={entry.carNumber}>
            <TableCell className="tabular-nums">{entry.rank}</TableCell>
            <TableCell className="tabular-nums">{entry.carNumber}</TableCell>
            <TableCell>{entry.teamName}</TableCell>
            <TableCell>{entry.schoolName}</TableCell>
            <TableCell className="tabular-nums">{formatPoints(entry.points)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

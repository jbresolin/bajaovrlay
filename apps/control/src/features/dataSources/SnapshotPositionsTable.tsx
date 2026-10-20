import type { PositionEntry, PositionsShape } from '@bajaovrlay/shared';

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

import { formatGapToLeader, formatLapTime } from './timingScreenText';

const texts = ptBR.dataSources.positionsTable;
const unknownValue = ptBR.dataSources.detail.unknownValue;

/** Writes a lap time, or a dash when the source does not know it. */
function formatLapTimeOrUnknown(lapTimeMs: number | undefined): string {
  return lapTimeMs === undefined ? unknownValue : formatLapTime(lapTimeMs);
}

/**
 * The positions of the selected source, one row per car in the order the source gave:
 * place, car, team, school, laps, last and best lap (m:ss.mmm), the gap to the leader
 * ("+12,3 s" or "+2 voltas") and what the car is doing. The table scrolls sideways in
 * its own box on a narrow screen (components/ui/table.tsx).
 * With `corrections` (a stored source, not a "Testar" result), the positions shown are
 * the corrected ones and a car's team, school and status can be corrected
 * (CorrectableValue.tsx); `positionsAsSent` is what the source itself sent.
 */
export function SnapshotPositionsTable(props: {
  positions: PositionsShape;
  corrections?: { sourceId: string; sourceLabel: string; positionsAsSent: PositionsShape };
}) {
  const columns = texts.columns;
  const { corrections } = props;

  /** One correctable cell of a car, or the plain value without corrections. */
  function drawCarValue(
    entry: PositionEntry,
    entryAsSent: PositionEntry | undefined,
    field: 'teamName' | 'schoolName' | 'status',
    writeValue: (car: PositionEntry) => string,
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
          <TableHead>{columns.position}</TableHead>
          <TableHead>{columns.carNumber}</TableHead>
          <TableHead>{columns.teamName}</TableHead>
          <TableHead>{columns.schoolName}</TableHead>
          <TableHead>{columns.laps}</TableHead>
          <TableHead>{columns.lastLap}</TableHead>
          <TableHead>{columns.bestLap}</TableHead>
          <TableHead>{columns.gap}</TableHead>
          <TableHead>{columns.status}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.positions.entries.map((entry, index) => {
          const entryAsSent = corrections?.positionsAsSent.entries[index];
          return (
            <TableRow key={entry.carNumber}>
              <TableCell className="tabular-nums">{entry.position}</TableCell>
              <TableCell className="tabular-nums">{entry.carNumber}</TableCell>
              <TableCell>
                {drawCarValue(entry, entryAsSent, 'teamName', (car) => car.teamName)}
              </TableCell>
              <TableCell>
                {drawCarValue(entry, entryAsSent, 'schoolName', (car) => car.schoolName)}
              </TableCell>
              <TableCell className="tabular-nums">{entry.laps}</TableCell>
              <TableCell className="tabular-nums">
                {formatLapTimeOrUnknown(entry.lastLapMs)}
              </TableCell>
              <TableCell className="tabular-nums">
                {formatLapTimeOrUnknown(entry.bestLapMs)}
              </TableCell>
              <TableCell className="tabular-nums">{formatGapToLeader(entry)}</TableCell>
              <TableCell>
                {drawCarValue(entry, entryAsSent, 'status', (car) => texts.statuses[car.status])}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

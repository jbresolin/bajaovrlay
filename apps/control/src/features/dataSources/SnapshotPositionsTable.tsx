import type { PositionEntry, PositionsShape } from '@bajaovrlay/shared';
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
import { formatGapToLeader, formatLapTime } from './timingScreenText';

const texts = ptBR.dataSources.positionsTable;
const columns = texts.columns;
const unknownValue = ptBR.dataSources.detail.unknownValue;

/** Writes a lap time, or a dash when the source does not know it. */
function formatLapTimeOrUnknown(lapTimeMs: number | undefined): string {
  return lapTimeMs === undefined ? unknownValue : formatLapTime(lapTimeMs);
}

/** One correctable value of a car, or the plain value without corrections. */
function CarValue(props: {
  entry: PositionEntry;
  entryAsSent: PositionEntry | undefined;
  corrections: CorrectionsOfSource | undefined;
  field: 'teamName' | 'schoolName' | 'status';
  writeValue: (car: PositionEntry) => string;
}) {
  const { entry, corrections, field, writeValue } = props;
  if (corrections === undefined) {
    return writeValue(entry);
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
      valueText={writeValue(entry)}
      valueAsSentText={writeValue(props.entryAsSent ?? entry)}
    />
  );
}

/**
 * One car's row. Memoised, compared by value (tableRowComparison.ts): a poll that did not
 * change this car leaves its row as it is.
 */
const PositionsRow = memo(function PositionsRow(props: {
  entry: PositionEntry;
  entryAsSent: PositionEntry | undefined;
  corrections: CorrectionsOfSource | undefined;
}) {
  const { entry } = props;
  return (
    <TableRow>
      <TableCell className="tabular-nums">{entry.position}</TableCell>
      <TableCell className="tabular-nums">{entry.carNumber}</TableCell>
      <TableCell>
        <CarValue {...props} field="teamName" writeValue={(car) => car.teamName} />
      </TableCell>
      <TableCell>
        <CarValue {...props} field="schoolName" writeValue={(car) => car.schoolName} />
      </TableCell>
      <TableCell className="tabular-nums">{entry.laps}</TableCell>
      <TableCell className="tabular-nums">{formatLapTimeOrUnknown(entry.lastLapMs)}</TableCell>
      <TableCell className="tabular-nums">{formatLapTimeOrUnknown(entry.bestLapMs)}</TableCell>
      <TableCell className="tabular-nums">{formatGapToLeader(entry)}</TableCell>
      <TableCell>
        <CarValue {...props} field="status" writeValue={(car) => texts.statuses[car.status]} />
      </TableCell>
    </TableRow>
  );
}, isTableRowTheSame);

/**
 * The positions of the selected source, one row per car in the order the source gave:
 * place, car, team, school, laps, last and best lap (m:ss.mmm), the gap to the leader
 * ("+12,3 s" or "+2 voltas") and what the car is doing. The table scrolls sideways in
 * its own box on a narrow screen (components/ui/table.tsx).
 * With `corrections` (a stored source, not a "Testar" result), the positions shown are
 * the corrected ones and a car's team, school and status can be corrected
 * (CorrectableValue.tsx); `positionsAsSent` is what the source itself sent, matched to
 * each row by car number (a corrected list need not keep the source's order).
 */
export function SnapshotPositionsTable(props: {
  positions: PositionsShape;
  corrections?: CorrectionsOfSource & { positionsAsSent: PositionsShape };
}) {
  const { corrections } = props;
  const entriesAsSentByCar = new Map(
    (corrections?.positionsAsSent.entries ?? []).map((entry) => [entry.carNumber, entry]),
  );
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
        {props.positions.entries.map((entry) => (
          <PositionsRow
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

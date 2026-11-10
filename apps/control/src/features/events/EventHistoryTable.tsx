import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ActionButton } from '@/features/connection/ActionButton';
import {
  useWhyTheDataRoleMayNotShowAgain,
  useWhyTheDataRoleMayNotTriage,
} from '@/features/events/whyTheDataRoleMayNotTriage';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import {
  chooseHistorySortAfterClickOn,
  type HistorySort,
  type HistorySortColumn,
  listHistoryRows,
  newestFirstSort,
} from './eventHistoryView';

const texts = ptBR.events.reviewPage;
const columns = texts.columns;
const searchBoxId = 'event-history-search';

/**
 * One sortable header: a button with the column's name that sorts by it (again: the other
 * way), and `aria-sort` on the header cell of the column sorted, so a screen reader says
 * which way. The arrow is for the eye only.
 */
function SortableHeader(props: {
  column: HistorySortColumn;
  sort: HistorySort;
  onSortChosen: (sort: HistorySort) => void;
}) {
  const { column, sort } = props;
  const isSortedByThisColumn = sort.column === column;
  const arrow = sort.direction === 'ascending' ? '▲' : '▼';
  return (
    <TableHead aria-sort={isSortedByThisColumn ? sort.direction : undefined}>
      <Button
        size="xs"
        variant="ghost"
        className="-ml-2 font-medium"
        onClick={() => props.onSortChosen(chooseHistorySortAfterClickOn(sort, column))}
      >
        {columns[column]}
        {isSortedByThisColumn ? <span aria-hidden="true">{arrow}</span> : null}
      </Button>
    </TableHead>
  );
}

/**
 * The history on the "Eventos" page: every event the server keeps (its newest 200), one
 * row each: the time of day it arrived (on the operator's clock), what it is, the car,
 * the team, the lap, its details (reason, penalty, lap time), where it came from (a
 * source's name, or "Digitado") and its status. "Buscar no histórico" above it keeps the
 * rows it finds, and a click on a header sorts by that column (eventHistoryView.ts);
 * newest first until then. Both are this page's own view, lost on a reload. "Nenhum
 * evento ainda." stands in for an empty history, "Nenhum evento encontrado." for a search
 * that finds nothing. A dismissed event has "Restaurar" (restoreEvent): humans err (the
 * walk of PR #22); a shown or expired one has "Mostrar de novo" (restoreEvent too,
 * BAJAOVRLAY-67), for an event the commentators come back to. Either brings the event
 * back to wait for "No ar"; Dados sees "Mostrar de novo" greyed out, never hidden.
 */
export function EventHistoryTable() {
  const events = useServerState((state) => state.events);
  const dataSources = useServerState((state) => state.dataSources);
  const sendCommand = useSendCommand();
  const findWhyTheDataRoleMayNotTriage = useWhyTheDataRoleMayNotTriage();
  const findWhyTheDataRoleMayNotShowAgain = useWhyTheDataRoleMayNotShowAgain();
  const [searchText, setSearchText] = useState('');
  const [sort, setSort] = useState<HistorySort>(newestFirstSort);

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">{texts.noEventsYet}</p>;
  }

  const rows = listHistoryRows(events, dataSources, { searchText, sort });
  const sortableHeaderProps = { sort, onSortChosen: setSort };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex max-w-sm flex-col gap-1">
        <Label htmlFor={searchBoxId}>{texts.searchLabel}</Label>
        <Input
          id={searchBoxId}
          type="search"
          placeholder={texts.searchPlaceholder}
          value={searchText}
          onChange={(change) => setSearchText(change.target.value)}
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{texts.nothingFound}</p>
      ) : (
        <Table aria-label={texts.historyTableLabel}>
          <TableHeader>
            <TableRow>
              <SortableHeader column="time" {...sortableHeaderProps} />
              <SortableHeader column="kind" {...sortableHeaderProps} />
              <SortableHeader column="car" {...sortableHeaderProps} />
              <SortableHeader column="team" {...sortableHeaderProps} />
              <SortableHeader column="lap" {...sortableHeaderProps} />
              <TableHead>{columns.details}</TableHead>
              <SortableHeader column="origin" {...sortableHeaderProps} />
              <SortableHeader column="status" {...sortableHeaderProps} />
              <TableHead>{columns.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ event, cells }) => (
              <TableRow key={event.eventId}>
                <TableCell className="tabular-nums">{cells.time}</TableCell>
                <TableCell>{cells.kind}</TableCell>
                <TableCell className="tabular-nums">{cells.car}</TableCell>
                <TableCell>{cells.team}</TableCell>
                <TableCell className="tabular-nums">{cells.lap}</TableCell>
                <TableCell className="whitespace-normal">{cells.details}</TableCell>
                <TableCell>{cells.origin}</TableCell>
                <TableCell>{cells.status}</TableCell>
                <TableCell>
                  {event.status === 'dismissed' ? (
                    <ActionButton
                      commandType="restoreEvent"
                      disabledReason={findWhyTheDataRoleMayNotTriage(event)}
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        void sendCommand({ type: 'restoreEvent', eventId: event.eventId })
                      }
                    >
                      {texts.restoreButton}
                    </ActionButton>
                  ) : null}
                  {event.status === 'shown' || event.status === 'expired' ? (
                    <ActionButton
                      commandType="restoreEvent"
                      disabledReason={findWhyTheDataRoleMayNotShowAgain(event)}
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        void sendCommand({ type: 'restoreEvent', eventId: event.eventId })
                      }
                    >
                      {texts.showAgainButton}
                    </ActionButton>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

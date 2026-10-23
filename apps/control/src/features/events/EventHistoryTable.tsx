import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ActionButton } from '@/features/connection/ActionButton';
import { formatTimeOfDay } from '@/features/dataSources/timeOfDayText';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { listAllEventsNewestFirst } from './inboxEventLists';
import {
  describeDetailsOfEvent,
  describeKindOfEvent,
  describeOriginOfEvent,
} from './inboxEventText';

const texts = ptBR.events.reviewPage;
const columns = texts.columns;

/**
 * The history on the "Eventos" page: every event the server keeps (its newest 200),
 * newest first, one row each: the time of day it arrived (on the operator's clock),
 * what it is, the car, the team, the lap, its details (reason, penalty, lap time), where
 * it came from (a source's name, or "Digitado") and its status. "Nenhum evento ainda."
 * stands in for an empty table. The waiting events above it have the buttons; here only a
 * dismissed event has one, "Restaurar" (restoreEvent): humans err (the walk of PR #22).
 */
export function EventHistoryTable() {
  const events = useServerState((state) => state.events);
  const dataSources = useServerState((state) => state.dataSources);
  const sendCommand = useSendCommand();

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">{texts.noEventsYet}</p>;
  }

  return (
    <Table aria-label={texts.historyTableLabel}>
      <TableHeader>
        <TableRow>
          <TableHead>{columns.time}</TableHead>
          <TableHead>{columns.kind}</TableHead>
          <TableHead>{columns.car}</TableHead>
          <TableHead>{columns.team}</TableHead>
          <TableHead>{columns.lap}</TableHead>
          <TableHead>{columns.details}</TableHead>
          <TableHead>{columns.origin}</TableHead>
          <TableHead>{columns.status}</TableHead>
          <TableHead>{columns.actions}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {listAllEventsNewestFirst(events).map((event) => (
          <TableRow key={event.eventId}>
            <TableCell className="tabular-nums">{formatTimeOfDay(event.detectedAtMs)}</TableCell>
            <TableCell>{describeKindOfEvent(event)}</TableCell>
            <TableCell className="tabular-nums">{event.payload.carNumber}</TableCell>
            <TableCell>{event.payload.teamName ?? ''}</TableCell>
            <TableCell className="tabular-nums">{event.payload.lapNumber ?? ''}</TableCell>
            <TableCell className="whitespace-normal">{describeDetailsOfEvent(event)}</TableCell>
            <TableCell>{describeOriginOfEvent(event, dataSources)}</TableCell>
            <TableCell>{ptBR.events.statusWords[event.status]}</TableCell>
            <TableCell>
              {event.status === 'dismissed' ? (
                <ActionButton
                  size="xs"
                  variant="outline"
                  onClick={() => void sendCommand({ type: 'restoreEvent', eventId: event.eventId })}
                >
                  {texts.restoreButton}
                </ActionButton>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

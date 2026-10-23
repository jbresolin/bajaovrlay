import type { CommandInput, InboxEvent } from '@bajaovrlay/shared';

import { Badge } from '@/components/ui/badge';
import { ActionButton } from '@/features/connection/ActionButton';
import { formatRelativeTimePtBR } from '@/i18n/formatRelativeTimePtBR';
import { ptBR } from '@/i18n/ptBR';

import { describeKindOfEvent } from './inboxEventText';

const texts = ptBR.events;

/**
 * One waiting event of the "Eventos" tab: what it is, the car's chip, the team, the
 * reason, the penalty or the lap time, how long ago it arrived (and "na fila" when the
 * runner will show it), then "Prévia" (the rule's item filled from this event; off when
 * the rule has no item), "No ar" and "Descartar". The buttons only send; what happens is
 * the server's, and the row follows the `events` slice.
 */
export function InboxEventRow(props: {
  event: InboxEvent;
  /** The item its rule shows it with, or null when the rule has none. */
  itemIdOfItsRule: string | null;
  now: Date;
  sendCommand: (command: CommandInput) => Promise<boolean>;
}) {
  const { event, itemIdOfItsRule, now, sendCommand } = props;
  const { payload } = event;
  return (
    <li className="flex flex-col gap-1 rounded-md border p-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{describeKindOfEvent(event)}</span>
        <span className="rounded-sm bg-primary px-1.5 font-semibold text-primary-foreground tabular-nums">
          {payload.carNumber}
        </span>
        {payload.teamName === undefined ? null : <span>{payload.teamName}</span>}
        {event.status === 'queued' ? (
          <Badge variant="secondary">{texts.statusWords.queued}</Badge>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {formatRelativeTimePtBR(new Date(event.detectedAtMs), now)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {payload.reason === undefined ? null : <span>{payload.reason}</span>}
        {payload.penaltyText === undefined ? null : (
          <span className="font-semibold text-foreground">{payload.penaltyText}</span>
        )}
        {payload.lapTimeText === undefined ? null : (
          <span className="tabular-nums">{payload.lapTimeText}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        <ActionButton
          size="xs"
          variant="outline"
          disabled={itemIdOfItsRule === null}
          onClick={() => {
            if (itemIdOfItsRule !== null) {
              void sendCommand({
                type: 'previewItem',
                itemId: itemIdOfItsRule,
                eventId: event.eventId,
                origin: 'manual',
              });
            }
          }}
        >
          {texts.previewButton}
        </ActionButton>
        <ActionButton
          size="xs"
          onClick={() => void sendCommand({ type: 'showEvent', eventId: event.eventId })}
        >
          {texts.showButton}
        </ActionButton>
        <ActionButton
          size="xs"
          variant="ghost"
          onClick={() => void sendCommand({ type: 'dismissEvent', eventId: event.eventId })}
        >
          {texts.dismissButton}
        </ActionButton>
      </div>
    </li>
  );
}

/** One event that is over, greyed: what it was, the car, the team, and its status. */
export function FinishedEventRow(props: { event: InboxEvent }) {
  const { event } = props;
  return (
    <li className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground opacity-70">
      <span>{describeKindOfEvent(event)}</span>
      <span className="tabular-nums">{event.payload.carNumber}</span>
      {event.payload.teamName === undefined ? null : <span>{event.payload.teamName}</span>}
      <span className="ml-auto">{texts.statusWords[event.status]}</span>
    </li>
  );
}

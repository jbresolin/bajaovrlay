import type { CommandInput, InboxEvent } from '@bajaovrlay/shared';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { ActionButton } from '@/features/connection/ActionButton';
import { formatRelativeTimePtBR } from '@/i18n/formatRelativeTimePtBR';
import { ptBR } from '@/i18n/ptBR';
import { formatTimeOfDay } from '@/i18n/timeOfDayText';

import { describeKindOfEvent } from './inboxEventText';

const texts = ptBR.events;

/**
 * One waiting event, on the console's "Eventos" tab and on the "Eventos" page: what it
 * is, the car's chip, the team, the reason, the penalty or the lap time, the time of day
 * it arrived (on the operator's clock) beside how long ago ("14:05:00 há 5 min"), "na
 * fila" when the runner will show it, then "Prévia" (the rule's item filled from this
 * event), "No ar" and "Descartar". "Prévia" and "No ar" are off, saying why, when the rule has no item;
 * "No ar" and "Descartar" are off while one of their commands waits, so a second press
 * cannot send it twice (gate 2 of PR #22). The buttons only send; what happens is the
 * server's, and the row follows the `events` slice.
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
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);
  const whyThereIsNoItem = itemIdOfItsRule === null ? texts.ruleWithoutItemReason : undefined;

  /** Sends "No ar" or "Descartar", the two buttons off until the server answers. */
  async function sendAndWaitForTheAnswer(command: CommandInput): Promise<void> {
    setIsWaitingForTheServer(true);
    await sendCommand(command);
    setIsWaitingForTheServer(false);
  }
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
        <span className="ml-auto flex gap-1.5 text-xs text-muted-foreground">
          <time className="tabular-nums" dateTime={new Date(event.detectedAtMs).toISOString()}>
            {formatTimeOfDay(event.detectedAtMs)}
          </time>
          <span>{formatRelativeTimePtBR(new Date(event.detectedAtMs), now)}</span>
        </span>
      </div>
      {/* The details, then the three buttons at the right end of the same line; in a
          narrow column the buttons move under the details together, never one by one. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {payload.reason === undefined ? null : <span>{payload.reason}</span>}
          {payload.penaltyText === undefined ? null : (
            <span className="font-semibold text-foreground">{payload.penaltyText}</span>
          )}
          {payload.lapTimeText === undefined ? null : (
            <span className="tabular-nums">{payload.lapTimeText}</span>
          )}
        </span>
        <span className="ml-auto flex shrink-0 gap-1">
          <ActionButton
            commandType="previewItem"
            size="xs"
            variant="outline"
            disabledReason={whyThereIsNoItem}
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
            commandType="showEvent"
            size="xs"
            disabled={isWaitingForTheServer}
            disabledReason={whyThereIsNoItem}
            onClick={() =>
              void sendAndWaitForTheAnswer({ type: 'showEvent', eventId: event.eventId })
            }
          >
            {texts.showButton}
          </ActionButton>
          <ActionButton
            commandType="dismissEvent"
            size="xs"
            variant="ghost"
            disabled={isWaitingForTheServer}
            onClick={() =>
              void sendAndWaitForTheAnswer({ type: 'dismissEvent', eventId: event.eventId })
            }
          >
            {texts.dismissButton}
          </ActionButton>
        </span>
      </div>
    </li>
  );
}

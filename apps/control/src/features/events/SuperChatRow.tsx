import type { CommandInput, InboxEvent } from '@bajaovrlay/shared';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';
import { formatTimeOfDay } from '@/i18n/timeOfDayText';

import { describeHowLongTheEventHasWaited } from './inboxEventText';

const texts = ptBR.events;

/**
 * One viewer's Super Chat (BAJAOVRLAY-35), on the console's "Eventos" tab and the "Eventos"
 * page: the amount's chip, the viewer, the time it arrived and how long ago, then the whole
 * message ("Sem mensagem" when they wrote none), never cut, since whoever approves must read
 * all of it. Its buttons follow its status:
 * - awaiting approval: "Aprovar" (approveEvent) and "Descartar", and nothing that could put
 *   it on air;
 * - approved: "Prévia", "No ar" and "Descartar", like any waiting event, with "aprovado".
 * Dados may approve and dismiss; "Prévia" and "No ar" stay the Produtor's (ActionButton
 * greys them out by role). "Aprovar", "No ar" and "Descartar" are off while one of their
 * commands waits, so a second press cannot send it twice.
 */
export function SuperChatRow(props: {
  event: InboxEvent;
  /** The item its rule shows it with, or null when the rule has none. */
  itemIdOfItsRule: string | null;
  now: Date;
  sendCommand: (command: CommandInput) => Promise<boolean>;
}) {
  const { event, itemIdOfItsRule, now, sendCommand } = props;
  const { authorName, amountText, messageText } = event.payload;
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);
  const isApproved = event.status === 'approved';
  const whyThereIsNoItem = itemIdOfItsRule === null ? texts.ruleWithoutItemReason : undefined;
  const hasAMessage = messageText !== undefined && messageText !== '';

  /** Sends "Aprovar", "No ar" or "Descartar", the buttons off until the server answers. */
  async function sendAndWaitForTheAnswer(command: CommandInput): Promise<void> {
    setIsWaitingForTheServer(true);
    await sendCommand(command);
    setIsWaitingForTheServer(false);
  }

  return (
    <li className="flex flex-col gap-1 rounded-md border p-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{texts.kindWords.superChat}</span>
        {amountText === undefined ? null : (
          <span className="rounded-sm bg-primary px-1.5 font-semibold text-primary-foreground tabular-nums">
            {amountText}
          </span>
        )}
        {authorName === undefined ? null : <span>{authorName}</span>}
        {isApproved ? <Badge variant="secondary">{texts.statusWords.approved}</Badge> : null}
        <span className="ml-auto flex gap-1.5 text-xs text-muted-foreground">
          <time className="tabular-nums" dateTime={new Date(event.detectedAtMs).toISOString()}>
            {formatTimeOfDay(event.detectedAtMs)}
          </time>
          <span>{describeHowLongTheEventHasWaited(event, now)}</span>
        </span>
      </div>
      <p
        className={`text-sm break-words whitespace-pre-wrap ${hasAMessage ? '' : 'text-muted-foreground italic'}`}
      >
        {hasAMessage ? messageText : texts.superChatWithoutMessage}
      </p>
      <span className="ml-auto flex shrink-0 gap-1">
        {isApproved ? (
          <>
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
          </>
        ) : (
          <ActionButton
            commandType="approveEvent"
            size="xs"
            disabled={isWaitingForTheServer}
            onClick={() =>
              void sendAndWaitForTheAnswer({ type: 'approveEvent', eventId: event.eventId })
            }
          >
            {texts.approveButton}
          </ActionButton>
        )}
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
    </li>
  );
}

import type { CommandInput, InboxEvent } from '@bajaovrlay/shared';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ptBR } from '@/i18n/ptBR';

import { SuperChatRow } from './SuperChatRow';

const texts = ptBR.events;

/**
 * The Super Chats no person has approved yet (BAJAOVRLAY-35), newest first, under the hint
 * "3 aguardando aprovação", which opens and closes the list. Dados reads the chat, so the
 * list is open on Dados's pages and on the "Eventos" page; the Produtor runs the show, so on
 * the Produtor's console tab it starts closed, the hint alone saying how many wait, and a
 * press opens it to approve when working alone. Nothing at all when none waits. Whether it
 * is open is this page's own view, never the server's.
 */
export function SuperChatsAwaitingApproval(props: {
  superChats: InboxEvent[];
  isOpenAtFirst: boolean;
  itemIdOfTheSuperChatRule: string | null;
  now: Date;
  sendCommand: (command: CommandInput) => Promise<boolean>;
}) {
  const [isOpen, setIsOpen] = useState(props.isOpenAtFirst);
  const listId = useId();
  if (props.superChats.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        size="xs"
        variant="outline"
        className="self-start"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setIsOpen(!isOpen)}
      >
        {texts.superChatsAwaitingApproval(props.superChats.length)}
      </Button>
      {isOpen ? (
        <ul
          id={listId}
          aria-label={texts.superChatsAwaitingApprovalListLabel}
          className="flex flex-col gap-1"
        >
          {props.superChats.map((superChat) => (
            <SuperChatRow
              key={superChat.eventId}
              event={superChat}
              itemIdOfItsRule={props.itemIdOfTheSuperChatRule}
              now={props.now}
              sendCommand={props.sendCommand}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

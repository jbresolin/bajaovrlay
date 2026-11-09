import { useCurrentTime } from '@/features/layers/useCurrentTime';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';
import { useIsTheDataRoleLoggedIn } from '@/state/operatorSessionContext';

import {
  listSuperChatsAwaitingApprovalNewestFirst,
  listWaitingEventsNewestFirst,
} from './inboxEventLists';
import { InboxEventRow } from './InboxEventRow';
import { SuperChatRow } from './SuperChatRow';
import { SuperChatsAwaitingApproval } from './SuperChatsAwaitingApproval';

const texts = ptBR.events;

/** "há 2 min" moves on once a minute at most; checked every ten seconds. */
const ageRefreshIntervalMs = 10_000;

/**
 * The waiting events, newest first, or "Nenhum evento esperando." when none waits. Drawn
 * alike on the console's "Eventos" tab, where its parent caps the height, and on the
 * "Eventos" page (`isOnTheReviewPage`).
 * - First, the Super Chats awaiting approval (SuperChatsAwaitingApproval.tsx, BAJAOVRLAY-35)
 *   with "Aprovar" and "Descartar": open for Dados and on the page, a hint ("3 aguardando
 *   aprovação") that opens them on the Produtor's console tab.
 * - Then every other waiting event: a race event with "Prévia", "No ar" and "Descartar"
 *   (InboxEventRow.tsx), an approved Super Chat with the same three (SuperChatRow.tsx).
 * Dados sees every row, greyed where its role may not act ("greyed, never hidden"): Dados
 * may dismiss a Super Chat and nothing else, which the role column of dismissEvent cannot
 * say, so a race event's "Descartar" is greyed here with its reason.
 */
export function WaitingEventsList(props: { isOnTheReviewPage?: boolean }) {
  const events = useServerState((state) => state.events);
  const eventRules = useServerState((state) => state.eventRules);
  const sendCommand = useSendCommand();
  const now = useCurrentTime(ageRefreshIntervalMs);
  const isTheDataRoleLoggedIn = useIsTheDataRoleLoggedIn();

  const superChatsAwaitingApproval = listSuperChatsAwaitingApprovalNewestFirst(events);
  const waitingEvents = listWaitingEventsNewestFirst(events);
  const findItemIdOfTheRuleOfKind = (kind: string) =>
    eventRules.find((rule) => rule.kind === kind)?.itemId ?? null;
  const isNothingWaiting = waitingEvents.length === 0 && superChatsAwaitingApproval.length === 0;
  const whyDadosMayNotDismissARaceEvent = isTheDataRoleLoggedIn
    ? texts.dataRoleDismissesOnlySuperChats
    : undefined;

  return (
    <>
      {isNothingWaiting ? (
        <p className="text-sm text-muted-foreground">{texts.nothingWaiting}</p>
      ) : null}
      <SuperChatsAwaitingApproval
        superChats={superChatsAwaitingApproval}
        isOpenAtFirst={isTheDataRoleLoggedIn || props.isOnTheReviewPage === true}
        itemIdOfTheSuperChatRule={findItemIdOfTheRuleOfKind('superChat')}
        now={now}
        sendCommand={sendCommand}
      />
      <ul aria-label={texts.waitingListLabel} className="flex flex-col gap-1">
        {waitingEvents.map((event) =>
          event.kind === 'superChat' ? (
            <SuperChatRow
              key={event.eventId}
              event={event}
              itemIdOfItsRule={findItemIdOfTheRuleOfKind(event.kind)}
              now={now}
              sendCommand={sendCommand}
            />
          ) : (
            <InboxEventRow
              key={event.eventId}
              event={event}
              itemIdOfItsRule={findItemIdOfTheRuleOfKind(event.kind)}
              whyTheDismissalIsOff={whyDadosMayNotDismissARaceEvent}
              now={now}
              sendCommand={sendCommand}
            />
          ),
        )}
      </ul>
    </>
  );
}

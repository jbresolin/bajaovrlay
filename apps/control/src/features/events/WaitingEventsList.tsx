import { useCurrentTime } from '@/features/layers/useCurrentTime';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { listWaitingEventsNewestFirst } from './inboxEventLists';
import { InboxEventRow } from './InboxEventRow';

const texts = ptBR.events;

/** "há 2 min" moves on once a minute at most; checked every ten seconds. */
const ageRefreshIntervalMs = 10_000;

/**
 * The waiting events, newest first, each with "Prévia", "No ar" and "Descartar"
 * (InboxEventRow.tsx), or "Nenhum evento esperando." when none waits. Drawn alike on the
 * console's "Eventos" tab, where its parent caps the height, and on the "Eventos" page.
 */
export function WaitingEventsList() {
  const events = useServerState((state) => state.events);
  const eventRules = useServerState((state) => state.eventRules);
  const sendCommand = useSendCommand();
  const now = useCurrentTime(ageRefreshIntervalMs);

  const waitingEvents = listWaitingEventsNewestFirst(events);

  return (
    <>
      {waitingEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{texts.nothingWaiting}</p>
      ) : null}
      <ul aria-label={texts.waitingListLabel} className="flex flex-col gap-1">
        {waitingEvents.map((event) => (
          <InboxEventRow
            key={event.eventId}
            event={event}
            itemIdOfItsRule={eventRules.find((rule) => rule.kind === event.kind)?.itemId ?? null}
            now={now}
            sendCommand={sendCommand}
          />
        ))}
      </ul>
    </>
  );
}

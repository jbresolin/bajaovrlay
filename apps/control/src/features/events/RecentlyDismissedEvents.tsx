import { ActionButton } from '@/features/connection/ActionButton';
import { useCurrentTime } from '@/features/layers/useCurrentTime';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { listEventsDismissedJustNow } from './inboxEventLists';
import { describeKindOfEvent } from './inboxEventText';

const texts = ptBR.events;

/** The 30 s window of "Desfazer" closes within five seconds of its end. */
const windowCheckIntervalMs = 5_000;

/**
 * Under the console's waiting events: each event dismissed in the last 30 s, "Penalidade ·
 * carro 47", with "Desfazer" (restoreEvent), so a slip of the mouse on "Descartar" is
 * undone where it happened (the walk of PR #22). Read from the server's `events` slice, so
 * a refresh keeps it and another operator's dismissal shows too; nothing when there is
 * none. An older dismissal is restored from the "Eventos" page's history.
 */
export function RecentlyDismissedEvents() {
  const events = useServerState((state) => state.events);
  const sendCommand = useSendCommand();
  const now = useCurrentTime(windowCheckIntervalMs);

  const dismissedJustNow = listEventsDismissedJustNow(events, now.getTime());
  if (dismissedJustNow.length === 0) {
    return null;
  }

  return (
    <ul aria-label={texts.recentlyDismissedListLabel} className="flex flex-col gap-1">
      {dismissedJustNow.map((event) => (
        <li key={event.eventId} className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {texts.recentlyDismissedText(describeKindOfEvent(event), event.payload.carNumber)}
          </span>
          <span>{texts.statusWords.dismissed}</span>
          <ActionButton
            size="xs"
            variant="outline"
            className="ml-auto"
            onClick={() => void sendCommand({ type: 'restoreEvent', eventId: event.eventId })}
          >
            {texts.undoDismissButton}
          </ActionButton>
        </li>
      ))}
    </ul>
  );
}

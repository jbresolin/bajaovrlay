import { ActionButton } from '@/features/connection/ActionButton';
import { useServerAlignedTimeMs } from '@/features/dataSources/useServerAlignedTimeMs';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { listTriggerFiringsDismissedJustNow } from './triggerFiringLists';
import { readLabelOfMacro } from './triggerText';

const texts = ptBR.triggers.firings;

/** The 30 s window of "Desfazer" closes within five seconds of its end, as for events. */
const windowCheckIntervalMs = 5_000;

/**
 * Under the console's waiting firings: each firing dismissed in the last 30 s with
 * "Desfazer" (restoreTriggerFiring), exactly as RecentlyDismissedEvents.tsx offers it for
 * an event. Read from the server's slice, counted on the server's clock; nothing when none.
 */
export function RecentlyDismissedTriggerFirings() {
  const firings = useServerState((state) => state.triggerActivity.firings);
  const macros = useServerState((state) => state.macros);
  const sendCommand = useSendCommand();
  const nowMs = useServerAlignedTimeMs(windowCheckIntervalMs);

  const dismissedJustNow = listTriggerFiringsDismissedJustNow(firings, nowMs);
  if (dismissedJustNow.length === 0) {
    return null;
  }
  return (
    <ul aria-label={texts.recentlyDismissedListLabel} className="flex flex-col gap-1">
      {dismissedJustNow.map((firing) => (
        <li key={firing.firingId} className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{texts.title(firing.triggerName, readLabelOfMacro(firing.macroId, macros))}</span>
          <span>{texts.dismissedWord}</span>
          <ActionButton
            size="xs"
            variant="outline"
            className="ml-auto"
            onClick={() =>
              void sendCommand({ type: 'restoreTriggerFiring', firingId: firing.firingId })
            }
          >
            {texts.undoDismissButton}
          </ActionButton>
        </li>
      ))}
    </ul>
  );
}

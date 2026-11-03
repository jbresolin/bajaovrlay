import { useCurrentTime } from '@/features/layers/useCurrentTime';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { listWaitingTriggerFiringsNewestFirst } from './triggerFiringLists';
import { TriggerFiringRow } from './TriggerFiringRow';
import { readLabelOfMacro } from './triggerText';

const texts = ptBR.triggers.firings;

/** "há 2 min" moves on once a minute at most; checked every ten seconds, as for events. */
const ageRefreshIntervalMs = 10_000;

/**
 * The firings that wait for the operator (BAJAOVRLAY-48), newest first, each with "Rodar"
 * and "Descartar" (TriggerFiringRow.tsx); nothing when none waits. Drawn beside the waiting
 * events on the console's "Eventos" tab and on the "Eventos" page.
 */
export function WaitingTriggerFirings() {
  const firings = useServerState((state) => state.triggerActivity.firings);
  const macros = useServerState((state) => state.macros);
  const sendCommand = useSendCommand();
  const now = useCurrentTime(ageRefreshIntervalMs);

  const waitingFirings = listWaitingTriggerFiringsNewestFirst(firings);
  if (waitingFirings.length === 0) {
    return null;
  }
  return (
    <ul aria-label={texts.listLabel} className="flex flex-col gap-1">
      {waitingFirings.map((firing) => (
        <TriggerFiringRow
          key={firing.firingId}
          firing={firing}
          macroLabel={readLabelOfMacro(firing.macroId, macros)}
          now={now}
          sendCommand={sendCommand}
        />
      ))}
    </ul>
  );
}

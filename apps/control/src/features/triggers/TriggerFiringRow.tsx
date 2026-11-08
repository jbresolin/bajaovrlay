import type { CommandInput, TriggerFiring } from '@bajaovrlay/shared';
import { useState } from 'react';

import { ActionButton } from '@/features/connection/ActionButton';
import { formatRelativeTimePtBR } from '@/i18n/formatRelativeTimePtBR';
import { ptBR } from '@/i18n/ptBR';
import { formatTimeOfDay } from '@/i18n/timeOfDayText';

const texts = ptBR.triggers.firings;

/**
 * One firing that waits, in the console's "Eventos" tab and on the "Eventos" page:
 * "Gatilho: Botão da mesa → Fechar a sessão", the time it fired beside how long ago, its
 * data as "chave: valor", the reason an auto firing could not run by itself, then "Rodar"
 * (runTriggerFiring) and "Descartar" (dismissTriggerFiring), both off while one of them
 * waits for the server, as an event's row has them.
 */
export function TriggerFiringRow(props: {
  firing: TriggerFiring;
  macroLabel: string;
  now: Date;
  sendCommand: (command: CommandInput) => Promise<boolean>;
}) {
  const { firing, now, sendCommand } = props;
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);
  const dataEntries = Object.entries(firing.data);

  async function sendAndWaitForTheAnswer(command: CommandInput): Promise<void> {
    setIsWaitingForTheServer(true);
    await sendCommand(command);
    setIsWaitingForTheServer(false);
  }

  return (
    <li className="flex flex-col gap-1 rounded-md border p-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{texts.title(firing.triggerName, props.macroLabel)}</span>
        <span className="ml-auto flex gap-1.5 text-xs text-muted-foreground">
          <time className="tabular-nums" dateTime={new Date(firing.firedAtMs).toISOString()}>
            {formatTimeOfDay(firing.firedAtMs)}
          </time>
          <span>{formatRelativeTimePtBR(new Date(firing.firedAtMs), now)}</span>
        </span>
      </div>
      {firing.autoRunRefusal === null ? null : (
        <p className="w-fit rounded-sm bg-warning px-1.5 text-sm text-warning-foreground">
          {texts.autoRunRefusal(firing.autoRunRefusal)}
        </p>
      )}
      {/* The data, then the two buttons at the right end of the same line; in a narrow
          column the buttons move under the data together, never one by one. */}
      <div className="flex flex-wrap items-center gap-2">
        <ul
          aria-label={texts.dataLabel}
          className="flex flex-wrap gap-x-3 text-sm text-muted-foreground"
        >
          {dataEntries.length === 0 ? <li>{texts.noData}</li> : null}
          {dataEntries.map(([key, value]) => (
            <li key={key}>{texts.dataEntry(key, String(value))}</li>
          ))}
        </ul>
        <span className="ml-auto flex shrink-0 gap-1">
          <ActionButton
            commandType="runTriggerFiring"
            size="xs"
            disabled={isWaitingForTheServer}
            onClick={() =>
              void sendAndWaitForTheAnswer({ type: 'runTriggerFiring', firingId: firing.firingId })
            }
          >
            {texts.runButton}
          </ActionButton>
          <ActionButton
            commandType="dismissTriggerFiring"
            size="xs"
            variant="ghost"
            disabled={isWaitingForTheServer}
            onClick={() =>
              void sendAndWaitForTheAnswer({
                type: 'dismissTriggerFiring',
                firingId: firing.firingId,
              })
            }
          >
            {texts.dismissButton}
          </ActionButton>
        </span>
      </div>
    </li>
  );
}

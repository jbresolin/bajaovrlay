import type { DataSource } from '@bajaovrlay/shared';
import { type MouseEvent, useId } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ActionButton } from '@/features/connection/ActionButton';
import { DeleteItemButton } from '@/features/rundown/DeleteItemButton';
import { ptBR } from '@/i18n/ptBR';
import { useIsConnectedToServer, useSendCommand } from '@/state/ControlPageStateProvider';

import { DataSourceStatusChip } from './DataSourceStatusChip';
import { formatTimeOfDay } from './timeOfDayText';

const texts = ptBR.dataSources;
const millisecondsPerSecond = 1_000;

/**
 * What on a card does its own job, so a click on it must not also pick the source: every
 * button (the commands and "Ver" itself), the switch, the switch's label (a click there
 * flips the switch), links, and the whole commands area (marked data-card-controls).
 * The area is there because a disabled button or switch has pointer-events: none (shadcn),
 * so a real browser hands its click to what is under it, the area, and without the area
 * in this list a press on a greyed-out "Atualizar agora" would pick the source.
 * Anything new added to the card that is clickable belongs here.
 */
const cardControlsSelector = 'button, a, input, label, [role="switch"], [data-card-controls]';

/** Whether a click on the card landed on one of its controls rather than on its empty space. */
function isClickOnACardControl(event: MouseEvent<HTMLElement>): boolean {
  const clickedElement = event.target;
  if (!(clickedElement instanceof Element)) {
    return false;
  }
  return clickedElement.closest(cardControlsSelector) !== null;
}

/** What a row needs from the page. */
export type DataSourceRowProps = {
  source: DataSource;
  /** Whether this source's data is the one shown beside the list. */
  isSelected: boolean;
  /** Shows this source's data beside the list. */
  onSelect: () => void;
  /** Opens this source's form ("Editar"). */
  onEdit: () => void;
};

/**
 * One source in the list, as a card: a click anywhere on it except on its controls shows
 * its data beside the list, and so does its "Ver" button (for the keyboard). It shows its
 * label, its kind, its status chip, a "Gravando" badge while recording, when its last good data
 * came and how often it is read, why a recording stopped on its own, and its commands —
 * the on/off switch, "Atualizar agora", "Reiniciar corrida" (simulators only), "Gravar" /
 * "Parar gravação", "Editar" and "Excluir" (two presses, the rundown's DeleteItemButton).
 * Polling now, restarting the race and recording are offered only while the source is
 * on, since the server refuses them otherwise.
 * Refusals are shown under the list (DataSourcesPage.tsx).
 */
export function DataSourceRow(props: DataSourceRowProps) {
  const { source } = props;
  const sendCommand = useSendCommand();
  const isConnected = useIsConnectedToServer();
  const enabledSwitchId = useId();

  const lastOkAtMs = source.status.lastOkAtMs;
  const lastGoodDataText =
    lastOkAtMs === undefined
      ? texts.row.noGoodDataYet
      : texts.row.lastGoodData(formatTimeOfDay(lastOkAtMs));
  const pollIntervalSecondsText = (source.pollIntervalMs / millisecondsPerSecond).toLocaleString(
    'pt-BR',
  );

  const selectedCardClassName = props.isSelected ? 'border-primary' : '';

  // The card's click is for the mouse only: the keyboard way in is "Ver", a real button,
  // so the card itself is not made focusable (it would be a second Tab stop doing the same).
  function selectUnlessAControlWasClicked(event: MouseEvent<HTMLElement>) {
    if (isClickOnACardControl(event)) {
      return;
    }
    props.onSelect();
  }

  return (
    <li
      aria-label={source.label}
      className={`flex cursor-pointer flex-col gap-2 rounded-md border p-3 ${selectedCardClassName}`}
      onClick={selectUnlessAControlWasClicked}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{source.label}</span>
        <span className="text-sm text-muted-foreground">{texts.kinds[source.kind]}</span>
        <DataSourceStatusChip source={source} />
        {source.isRecording && <Badge variant="destructive">{texts.row.recordingBadge}</Badge>}
      </div>

      <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        <span>{lastGoodDataText}</span>
        <span>{texts.row.pollInterval(pollIntervalSecondsText)}</span>
      </p>
      {source.status.recordingError !== null && (
        <p className="text-sm text-destructive">{source.status.recordingError}</p>
      )}

      <div data-card-controls className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Switch
            id={enabledSwitchId}
            checked={source.isEnabled}
            disabled={!isConnected}
            onCheckedChange={(isEnabled) => {
              void sendCommand({ type: 'setDataSourceEnabled', sourceId: source.id, isEnabled });
            }}
          />
          <Label htmlFor={enabledSwitchId}>{texts.row.enabledSwitch}</Label>
        </div>
        <ActionButton
          size="xs"
          variant="outline"
          disabled={!source.isEnabled}
          onClick={() => void sendCommand({ type: 'pollDataSourceNow', sourceId: source.id })}
        >
          {texts.row.pollNowButton}
        </ActionButton>
        {source.kind === 'simulator' && (
          <ActionButton
            size="xs"
            variant="outline"
            disabled={!source.isEnabled}
            onClick={() => void sendCommand({ type: 'restartSimulatedRace', sourceId: source.id })}
          >
            {texts.row.restartRaceButton}
          </ActionButton>
        )}
        {source.isRecording ? (
          <ActionButton
            size="xs"
            variant="outline"
            onClick={() => void sendCommand({ type: 'stopRecording', sourceId: source.id })}
          >
            {texts.row.stopRecordingButton}
          </ActionButton>
        ) : (
          <ActionButton
            size="xs"
            variant="outline"
            disabled={!source.isEnabled}
            onClick={() => void sendCommand({ type: 'startRecording', sourceId: source.id })}
          >
            {texts.row.startRecordingButton}
          </ActionButton>
        )}
        <Button
          size="xs"
          variant="outline"
          aria-pressed={props.isSelected}
          onClick={props.onSelect}
        >
          {texts.row.viewButton}
        </Button>
        <Button size="xs" variant="ghost" onClick={props.onEdit}>
          {texts.row.editButton}
        </Button>
        <DeleteItemButton
          texts={{
            deleteButton: texts.row.deleteButton,
            confirmButton: texts.row.deleteConfirmButton,
          }}
          onDeleteConfirmed={() =>
            void sendCommand({ type: 'deleteDataSource', sourceId: source.id })
          }
        />
      </div>
    </li>
  );
}

import type { DataSource } from '@bajaovrlay/shared';
import { useId } from 'react';

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
 * One source in the list: its label (a button that shows its data beside the list), its
 * kind, its status chip, a "Gravando" badge while recording, when its last good data
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

  return (
    <li aria-label={source.label} className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="link"
          className="h-auto p-0 font-semibold"
          aria-pressed={props.isSelected}
          onClick={props.onSelect}
        >
          {source.label}
        </Button>
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

      <div className="flex flex-wrap items-center gap-2">
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

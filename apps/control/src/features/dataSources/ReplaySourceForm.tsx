import { type ReplayDataSource, replaySpeeds } from '@bajaovrlay/shared';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { buildErrorAttributesForControl, FormFieldRow } from '@/features/items/FormFieldRow';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import { DataSourceFormCard } from './DataSourceFormCard';
import {
  buildReplaySourceFormValues,
  readReplaySourceForm,
  type ReplaySourceFormValues,
  resolveReplaySourceForm,
} from './replaySourceForm';
import { formatDateAndTimeOfDay } from './timeOfDayText';
import { useSaveDataSource } from './useSaveDataSource';

const texts = ptBR.dataSources.form;

/** What the page gives the form. */
export type ReplaySourceFormProps = {
  /** The stored replay to change ("Editar"), or null for a new one ("+ Fonte"). */
  sourceBeingEdited: ReplayDataSource | null;
  /** Called after the server accepted the save, and on "Cancelar". */
  onClose: () => void;
};

/**
 * The replay's form ("Reprodução"), written by hand for this kind. The recording is
 * picked from the `recordings` slice, and only among recordings that have ended: one
 * still being written cannot be replayed (the server refuses it). The speed is picked
 * from the fixed list; "Começar em" is optional seconds into the recording. "Salvar
 * fonte" reads the form (replaySourceForm.ts, the shared ReplayConfigSchema).
 */
export function ReplaySourceForm(props: ReplaySourceFormProps) {
  const recordings = useServerState((state) => state.recordings);
  const [sourceAsOpened] = useState(props.sourceBeingEdited);
  const form = useForm<ReplaySourceFormValues>({
    defaultValues: buildReplaySourceFormValues(sourceAsOpened),
    resolver: resolveReplaySourceForm,
  });
  const { saveFormReading, isWaitingForTheServer, wasLastSaveRefused } = useSaveDataSource({
    kind: 'replay',
    sourceAsOpened,
    onSaved: props.onClose,
  });
  const errors = form.formState.errors;
  const controlIdPrefix = `fonte-reproducao-${sourceAsOpened?.id ?? 'nova'}`;
  const endedRecordings = recordings.filter((recording) => recording.endedAtMs !== null);

  const save = form.handleSubmit(async (values) => {
    const reading = readReplaySourceForm(values);
    if (reading.isValid) {
      await saveFormReading(reading);
    }
  });

  const title =
    sourceAsOpened === null
      ? texts.newSourceTitle(ptBR.dataSources.kinds.replay)
      : texts.editSourceTitle(sourceAsOpened.label);
  const ids = {
    label: `${controlIdPrefix}-label`,
    pollIntervalSeconds: `${controlIdPrefix}-pollIntervalSeconds`,
    recordingId: `${controlIdPrefix}-recordingId`,
    speed: `${controlIdPrefix}-speed`,
    isLooping: `${controlIdPrefix}-isLooping`,
    startOffsetSeconds: `${controlIdPrefix}-startOffsetSeconds`,
  };
  return (
    <DataSourceFormCard
      title={title}
      isWaitingForTheServer={isWaitingForTheServer}
      wasLastSaveRefused={wasLastSaveRefused}
      onSave={() => void save()}
      onCancel={props.onClose}
    >
      <FormFieldRow
        label={texts.fields.label}
        controlId={ids.label}
        errorMessage={errors.label?.message}
      >
        <Input
          id={ids.label}
          {...form.register('label')}
          {...buildErrorAttributesForControl(ids.label, errors.label?.message)}
        />
      </FormFieldRow>
      <FormFieldRow
        label={texts.fields.pollIntervalSeconds}
        controlId={ids.pollIntervalSeconds}
        errorMessage={errors.pollIntervalSeconds?.message}
      >
        <Input
          id={ids.pollIntervalSeconds}
          inputMode="decimal"
          {...form.register('pollIntervalSeconds')}
          {...buildErrorAttributesForControl(
            ids.pollIntervalSeconds,
            errors.pollIntervalSeconds?.message,
          )}
        />
      </FormFieldRow>
      <FormFieldRow
        label={texts.fields.recordingId}
        controlId={ids.recordingId}
        errorMessage={errors.recordingId?.message}
      >
        {endedRecordings.length === 0 && (
          <p className="text-sm text-muted-foreground">{texts.noEndedRecordings}</p>
        )}
        <Controller
          control={form.control}
          name="recordingId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id={ids.recordingId}
                className="w-full"
                {...buildErrorAttributesForControl(ids.recordingId, errors.recordingId?.message)}
              >
                <SelectValue placeholder={texts.nothingChosenPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {endedRecordings.map((recording) => (
                  <SelectItem key={recording.id} value={recording.id}>
                    {texts.recordingOption(
                      recording.sourceLabel,
                      formatDateAndTimeOfDay(recording.startedAtMs),
                      recording.snapshotCount,
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormFieldRow>
      <FormFieldRow
        label={texts.fields.replaySpeed}
        controlId={ids.speed}
        errorMessage={errors.speed?.message}
      >
        <Controller
          control={form.control}
          name="speed"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id={ids.speed} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {replaySpeeds.map((speed) => (
                  <SelectItem key={speed} value={String(speed)}>
                    {texts.replaySpeedOption(speed)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormFieldRow>
      <FormFieldRow
        label={texts.fields.startOffsetSeconds}
        controlId={ids.startOffsetSeconds}
        errorMessage={errors.startOffsetSeconds?.message}
      >
        <Input
          id={ids.startOffsetSeconds}
          inputMode="decimal"
          {...form.register('startOffsetSeconds')}
          {...buildErrorAttributesForControl(
            ids.startOffsetSeconds,
            errors.startOffsetSeconds?.message,
          )}
        />
      </FormFieldRow>
      <Controller
        control={form.control}
        name="isLooping"
        render={({ field }) => (
          <div className="flex items-center gap-2">
            <Switch id={ids.isLooping} checked={field.value} onCheckedChange={field.onChange} />
            <Label htmlFor={ids.isLooping}>{texts.fields.isLooping}</Label>
          </div>
        )}
      />
    </DataSourceFormCard>
  );
}

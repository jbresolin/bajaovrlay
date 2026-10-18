import type { SimulatorDataSource } from '@bajaovrlay/shared';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { buildErrorAttributesForControl, FormFieldRow } from '@/features/items/FormFieldRow';
import { ptBR } from '@/i18n/ptBR';

import { DataSourceFormCard } from './DataSourceFormCard';
import {
  buildSimulatorSourceFormValues,
  readSimulatorSourceForm,
  resolveSimulatorSourceForm,
  type SimulatorSourceFormValues,
} from './simulatorSourceForm';
import { useSaveDataSource } from './useSaveDataSource';

const texts = ptBR.dataSources.form;

// The typed fields, in the order the form shows them, each with its label.
const typedFields: { name: keyof Omit<SimulatorSourceFormValues, 'isFailing'>; label: string }[] = [
  { name: 'label', label: texts.fields.label },
  { name: 'pollIntervalSeconds', label: texts.fields.pollIntervalSeconds },
  { name: 'seed', label: texts.fields.seed },
  { name: 'carCount', label: texts.fields.carCount },
  { name: 'sessionDurationMinutes', label: texts.fields.sessionDurationMinutes },
  { name: 'lapLengthKm', label: texts.fields.lapLengthKm },
  { name: 'speed', label: texts.fields.simulatorSpeed },
];

/** What the page gives the form. */
export type SimulatorSourceFormProps = {
  /** The stored simulator to change ("Editar"), or null for a new one ("+ Fonte"). */
  sourceBeingEdited: SimulatorDataSource | null;
  /** Called after the server accepted the save, and on "Cancelar". */
  onClose: () => void;
};

/**
 * The simulator's form, written by hand for this kind (adapter kinds are few and are not
 * graphics). Its fields are text in the operator's units; "Salvar fonte" reads them
 * (simulatorSourceForm.ts, the shared SimulatorConfigSchema) and shows a message under
 * each wrong field, or sends the source. "Falha simulada" makes every poll fail on
 * purpose, to rehearse a late source.
 */
export function SimulatorSourceForm(props: SimulatorSourceFormProps) {
  // The source as opened: "what changed" is judged against it, never a newer copy.
  const [sourceAsOpened] = useState(props.sourceBeingEdited);
  const form = useForm<SimulatorSourceFormValues>({
    defaultValues: buildSimulatorSourceFormValues(sourceAsOpened),
    resolver: resolveSimulatorSourceForm,
  });
  const { saveFormReading, isWaitingForTheServer, wasLastSaveRefused } = useSaveDataSource({
    kind: 'simulator',
    sourceAsOpened,
    onSaved: props.onClose,
  });
  const errors = form.formState.errors;
  const controlIdPrefix = `fonte-simulador-${sourceAsOpened?.id ?? 'nova'}`;
  const isFailingControlId = `${controlIdPrefix}-isFailing`;

  const save = form.handleSubmit(async (values) => {
    const reading = readSimulatorSourceForm(values);
    if (reading.isValid) {
      await saveFormReading(reading);
    }
  });

  const title =
    sourceAsOpened === null
      ? texts.newSourceTitle(ptBR.dataSources.kinds.simulator)
      : texts.editSourceTitle(sourceAsOpened.label);
  return (
    <DataSourceFormCard
      title={title}
      isWaitingForTheServer={isWaitingForTheServer}
      wasLastSaveRefused={wasLastSaveRefused}
      onSave={() => void save()}
      onCancel={props.onClose}
    >
      {typedFields.map((field) => {
        const controlId = `${controlIdPrefix}-${field.name}`;
        const errorMessage = errors[field.name]?.message;
        return (
          <FormFieldRow
            key={field.name}
            label={field.label}
            controlId={controlId}
            errorMessage={errorMessage}
          >
            <Input
              id={controlId}
              inputMode={field.name === 'label' ? 'text' : 'decimal'}
              {...form.register(field.name)}
              {...buildErrorAttributesForControl(controlId, errorMessage)}
            />
          </FormFieldRow>
        );
      })}
      <Controller
        control={form.control}
        name="isFailing"
        render={({ field }) => (
          <div className="flex items-center gap-2">
            <Switch
              id={isFailingControlId}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
            <Label htmlFor={isFailingControlId}>{texts.fields.isFailing}</Label>
          </div>
        )}
      />
    </DataSourceFormCard>
  );
}

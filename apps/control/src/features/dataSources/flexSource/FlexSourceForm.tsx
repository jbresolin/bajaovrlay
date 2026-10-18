import type { HttpJsonDataSource } from '@bajaovrlay/shared';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { buildErrorAttributesForControl, FormFieldRow } from '@/features/items/FormFieldRow';
import { ptBR } from '@/i18n/ptBR';

import { DataSourceFormCard } from '../DataSourceFormCard';
import { useSaveDataSource } from '../useSaveDataSource';
import { FlexConfigImportExport } from './FlexConfigImportExport';
import { FlexMappingsSection } from './FlexMappingsSection';
import { FlexRequestsSection } from './FlexRequestsSection';
import { readFlexSourceForm, resolveFlexSourceForm } from './flexSourceFormReading';
import { buildFlexSourceFormValues, type FlexSourceFormValues } from './flexSourceFormValues';
import { FlexTestPanel } from './FlexTestPanel';

const texts = ptBR.dataSources.form;

/** What the page gives the form. */
export type FlexSourceFormProps = {
  /** The stored flex source to change ("Editar"), or null for a new one ("+ Fonte"). */
  sourceBeingEdited: HttpJsonDataSource | null;
  /** Called after the server accepted the save, and on "Cancelar". */
  onClose: () => void;
};

/**
 * The flex HTTP/JSON source's form, written by hand like the other two: name and
 * interval, "Importar / Exportar configuração", the requests (FlexRequestsSection), the
 * mappings (FlexMappingsSection) and, beside them on a wide screen and under them on a
 * tablet, the "Testar" panel (FlexTestPanel), which runs the shared mapping in the
 * browser and sends nothing. "Salvar fonte" reads the form with the shared
 * HttpJsonConfigSchema (flexSourceFormReading.ts) and shows each refusal under its field.
 */
export function FlexSourceForm(props: FlexSourceFormProps) {
  // The source as opened: "what changed" is judged against it, never a newer copy.
  const [sourceAsOpened] = useState(props.sourceBeingEdited);
  const form = useForm<FlexSourceFormValues>({
    defaultValues: buildFlexSourceFormValues(sourceAsOpened),
    resolver: resolveFlexSourceForm,
  });
  // One field array for the requests, shared by the requests section and "Testar": the
  // panel keeps each sample under its request's field id, which only this array knows.
  const requests = useFieldArray({ control: form.control, name: 'requests' });
  const requestFieldIds = requests.fields.map((requestField) => requestField.id);
  const { saveFormReading, isWaitingForTheServer, wasLastSaveRefused } = useSaveDataSource({
    kind: 'httpJson',
    sourceAsOpened,
    onSaved: props.onClose,
  });
  const errors = form.formState.errors;
  const controlIdPrefix = `fonte-flex-${sourceAsOpened?.id ?? 'nova'}`;
  const ids = {
    label: `${controlIdPrefix}-label`,
    pollIntervalSeconds: `${controlIdPrefix}-pollIntervalSeconds`,
  };

  const save = form.handleSubmit(async (values) => {
    const reading = readFlexSourceForm(values);
    if (reading.isValid) {
      await saveFormReading(reading);
    }
  });

  const title =
    sourceAsOpened === null
      ? texts.newSourceTitle(ptBR.dataSources.kinds.httpJson)
      : texts.editSourceTitle(sourceAsOpened.label);
  const generalProblems = errors.root?.general?.message;
  return (
    <DataSourceFormCard
      title={title}
      isWaitingForTheServer={isWaitingForTheServer}
      wasLastSaveRefused={wasLastSaveRefused}
      onSave={() => void save()}
      onCancel={props.onClose}
    >
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>

      <FlexConfigImportExport form={form} controlIdPrefix={controlIdPrefix} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <FlexRequestsSection form={form} requests={requests} controlIdPrefix={controlIdPrefix} />
          <FlexMappingsSection form={form} controlIdPrefix={controlIdPrefix} />
        </div>
        <FlexTestPanel
          form={form}
          requestFieldIds={requestFieldIds}
          controlIdPrefix={controlIdPrefix}
        />
      </div>

      {generalProblems !== undefined && (
        <div role="alert" className="text-sm text-destructive">
          <p className="font-medium">
            {ptBR.dataSources.flexForm.fieldErrors.generalProblemsTitle}
          </p>
          <p>{generalProblems}</p>
        </div>
      )}
    </DataSourceFormCard>
  );
}

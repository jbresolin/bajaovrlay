import type { YouTubeLiveChatDataSource } from '@bajaovrlay/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { buildErrorAttributesForControl, FormFieldRow } from '@/features/items/FormFieldRow';
import { ptBR } from '@/i18n/ptBR';

import { DataSourceFormCard } from './DataSourceFormCard';
import { useSaveDataSource } from './useSaveDataSource';
import {
  buildYouTubeLiveChatSourceFormValues,
  readYouTubeLiveChatSourceForm,
  resolveYouTubeLiveChatSourceForm,
  type YouTubeLiveChatSourceFormValues,
} from './youtubeLiveChatSourceForm';

const texts = ptBR.dataSources.form;

// The fields, in the order the form shows them, each with its label.
const typedFields: { name: keyof YouTubeLiveChatSourceFormValues; label: string }[] = [
  { name: 'label', label: texts.fields.label },
  { name: 'liveAddress', label: texts.fields.liveAddress },
  { name: 'pollIntervalSeconds', label: texts.fields.pollIntervalSeconds },
];

/** What the page gives the form. */
export type YouTubeLiveChatSourceFormProps = {
  /** The stored YouTube source to change ("Editar"), or null for a new one ("+ Fonte"). */
  sourceBeingEdited: YouTubeLiveChatDataSource | null;
  /** Called after the server accepted the save, and on "Cancelar". */
  onClose: () => void;
};

/**
 * The YouTube live chat source's form (BAJAOVRLAY-35): a name, the live's address as
 * pasted, and the interval, 30 s for a new source and never under 10 s
 * (youtubeLiveChatSourceForm.ts). The key is never asked for: it stays on the server, as the
 * hint under the fields says.
 */
export function YouTubeLiveChatSourceForm(props: YouTubeLiveChatSourceFormProps) {
  // The source as opened: "what changed" is judged against it, never a newer copy.
  const [sourceAsOpened] = useState(props.sourceBeingEdited);
  const form = useForm<YouTubeLiveChatSourceFormValues>({
    defaultValues: buildYouTubeLiveChatSourceFormValues(sourceAsOpened),
    resolver: resolveYouTubeLiveChatSourceForm,
  });
  const { saveFormReading, isWaitingForTheServer, wasLastSaveRefused } = useSaveDataSource({
    kind: 'youtubeLiveChat',
    sourceAsOpened,
    onSaved: props.onClose,
  });
  const errors = form.formState.errors;
  const controlIdPrefix = `fonte-youtube-${sourceAsOpened?.id ?? 'nova'}`;

  const save = form.handleSubmit(async (values) => {
    const reading = readYouTubeLiveChatSourceForm(values);
    if (reading.isValid) {
      await saveFormReading(reading);
    }
  });

  const title =
    sourceAsOpened === null
      ? texts.newSourceTitle(ptBR.dataSources.kinds.youtubeLiveChat)
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
              inputMode={field.name === 'pollIntervalSeconds' ? 'decimal' : 'text'}
              {...form.register(field.name)}
              {...buildErrorAttributesForControl(controlId, errorMessage)}
            />
          </FormFieldRow>
        );
      })}
      <p className="text-xs text-muted-foreground">{texts.youTubeKeyHint}</p>
    </DataSourceFormCard>
  );
}

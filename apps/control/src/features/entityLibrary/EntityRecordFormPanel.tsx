import type { EntityType } from '@bajaovrlay/shared';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { ActionButton } from '@/features/connection/ActionButton';
import { FormFieldRow } from '@/features/items/FormFieldRow';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommandAndReadItsRefusal } from '@/state/ControlPageStateProvider';

import { EntityFormFieldControl } from './EntityFormFieldControl';
import {
  buildEntityFormValues,
  type EntityFormValues,
  listFormFieldsOfEntityType,
  readEntityFormValues,
} from './entityRecordForm';
import {
  type AnyEntityRecord,
  buildUpsertCommandOfRecord,
  describeRecordOfType,
} from './entityRecordsOfType';
import { LogoPlatePreview } from './LogoPlatePreview';
import { makeRecordId } from './recordId';

const texts = ptBR.entityLibrary.form;

/** What "Salvar" reads: why it is off, or "Salvar". */
function readSaveButtonText(isWaitingForTheServer: boolean, isAnImageUploading: boolean): string {
  if (isWaitingForTheServer) {
    return texts.savingButton;
  }
  if (isAnImageUploading) {
    return texts.waitingForImageButton;
  }
  return texts.saveButton;
}

/** What a tab gives its form. */
export type EntityRecordFormPanelProps = {
  entityType: EntityType;
  /** The stored record to change ("Editar"), or null for a new one ("+ Equipe"). */
  recordAsOpened: AnyEntityRecord | null;
  /** Called once the server accepted the save, and on "Cancelar". */
  onClose: () => void;
};

/**
 * The side-panel form of a Cadastros tab, the same for the four kinds of record: one
 * control per field of the kind (entityRecordForm.ts), its label, and the shared
 * schema's pt-BR sentence under a wrong field. "Salvar" sends upsertEntity, and the panel
 * closes once the server accepts; a refusal is shown above the buttons and the form
 * stays. A team's car number is its key, so it is typed for a new team only. A new
 * person, sponsor or slot gets one id when the form opens (makeRecordId, which works over
 * plain http), so two
 * presses of "Salvar" save the same record. While an image field uploads, "Salvar" is
 * off and reads "Enviando imagem…", and a submit does nothing (BAJAOVRLAY-51).
 */
export function EntityRecordFormPanel(props: EntityRecordFormPanelProps) {
  const { entityType, recordAsOpened } = props;
  const [newRecordId] = useState(() => makeRecordId());
  const sendCommandAndReadItsRefusal = useSendCommandAndReadItsRefusal();
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  // The keys of the image fields whose upload is still running. Until it ends the form
  // does not hold the new media id, so a save then would store the record without it.
  const [uploadingImageFieldKeys, setUploadingImageFieldKeys] = useState<string[]>([]);
  const isAnImageUploading = uploadingImageFieldKeys.length > 0;
  const form = useForm<EntityFormValues>({
    defaultValues: buildEntityFormValues(entityType, recordAsOpened),
  });
  // A team's logo as the form holds it now, for the light plate's preview.
  const logoMediaId = useWatch({ control: form.control, name: 'logoMediaId' }) ?? '';

  function markImageFieldUploading(recordFieldKey: string, isUploading: boolean): void {
    setUploadingImageFieldKeys((keysUploading) => {
      const otherKeysUploading = keysUploading.filter((key) => key !== recordFieldKey);
      return isUploading ? [...otherKeysUploading, recordFieldKey] : otherKeysUploading;
    });
  }

  const save = form.handleSubmit(async (values) => {
    // Checked here and not only on the button: Enter in a text field submits the form too.
    if (isAnImageUploading) {
      return;
    }
    const reading = readEntityFormValues(entityType, values, recordAsOpened, () => newRecordId);
    if (!reading.isValid) {
      for (const [fieldKey, message] of Object.entries(reading.errorsByField)) {
        form.setError(fieldKey, { message });
      }
      return;
    }
    setIsWaitingForTheServer(true);
    setRefusal(null);
    const refusalOfTheSave = await sendCommandAndReadItsRefusal(
      buildUpsertCommandOfRecord(entityType, reading.record),
    );
    setIsWaitingForTheServer(false);
    if (refusalOfTheSave === null) {
      props.onClose();
    } else {
      setRefusal(refusalOfTheSave);
    }
  });

  const title =
    recordAsOpened === null
      ? texts.newTitles[entityType]
      : texts.editTitle(describeRecordOfType(entityType, recordAsOpened));
  const controlIdPrefix = `cadastro-${entityType}`;
  return (
    <form
      aria-label={title}
      noValidate
      className="flex flex-col gap-3 rounded-lg border p-4"
      onSubmit={(event) => {
        void save(event);
      }}
    >
      <h3 className="font-semibold">{title}</h3>
      {listFormFieldsOfEntityType(entityType).map((field) => {
        const controlId = `${controlIdPrefix}-${field.recordFieldKey}`;
        const isTheKeyOfAStoredTeam =
          entityType === 'team' && field.recordFieldKey === 'carNumber' && recordAsOpened !== null;
        // An image or a checkbox is optional by its nature; the hint would only add noise.
        const isOptionalByItsNature = field.fieldKind === 'image' || field.fieldKind === 'yesNo';
        const label =
          field.isOptional && !isOptionalByItsNature
            ? `${field.label} ${texts.optionalHint}`
            : field.label;
        return (
          <FormFieldRow
            key={field.recordFieldKey}
            label={label}
            controlId={controlId}
            errorMessage={form.formState.errors[field.recordFieldKey]?.message}
          >
            <Controller
              control={form.control}
              name={field.recordFieldKey}
              render={({ field: controlledField }) => (
                <EntityFormFieldControl
                  field={field}
                  controlId={controlId}
                  value={controlledField.value ?? ''}
                  onChange={controlledField.onChange}
                  errorMessage={form.formState.errors[field.recordFieldKey]?.message}
                  isLocked={isTheKeyOfAStoredTeam}
                  onUploadingChange={(isUploading) => {
                    markImageFieldUploading(field.recordFieldKey, isUploading);
                  }}
                />
              )}
            />
            {isTheKeyOfAStoredTeam && (
              <p className="text-xs text-muted-foreground">{texts.carNumberIsTheKey}</p>
            )}
            {field.fieldKind === 'localDateTime' && (
              <p className="text-xs text-muted-foreground">{texts.dateTimeHint}</p>
            )}
            {field.recordFieldKey === 'logoOnLightPlate' && (
              <LogoPlatePreview logoMediaId={logoMediaId} />
            )}
          </FormFieldRow>
        );
      })}
      {refusal !== null && (
        <p role="alert" className="text-sm text-destructive">
          {refusal}
        </p>
      )}
      <div className="flex gap-2">
        <ActionButton
          type="submit"
          size="sm"
          disabled={isWaitingForTheServer || isAnImageUploading}
        >
          {readSaveButtonText(isWaitingForTheServer, isAnImageUploading)}
        </ActionButton>
        <Button type="button" size="sm" variant="ghost" onClick={props.onClose}>
          {texts.cancelButton}
        </Button>
      </div>
    </form>
  );
}

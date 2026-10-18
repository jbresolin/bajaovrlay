import type { Instance } from '@bajaovrlay/shared';
import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import {
  buildInstanceUpdateFromDirtySchemaFormFields,
  buildSchemaFormValuesFromDataOnAir,
  type SchemaFormDescription,
  type SchemaFormValues,
} from '@/features/schemaForm';
import {
  useReadServerStateNow,
  useSendCommand,
  useServerState,
} from '@/state/ControlPageStateProvider';

/** What the command of "Edição rápida" is built from. */
export type QuickEditCommandsOptions = {
  description: SchemaFormDescription;
  form: UseFormReturn<SchemaFormValues>;
  /** The loaded instance, in its newest copy: on air, or in preview. */
  instanceBeingEdited: Instance;
  /**
   * react-hook-form's `dirtyFields` as read while the form was drawn. Read there and not
   * at the press: react-hook-form keeps up to date only the parts of `formState` a
   * component reads as it draws, and that copy is what "changed" means for "Atualizar".
   */
  fieldsTheOperatorChanged: UseFormReturn<SchemaFormValues>['formState']['dirtyFields'];
};

/** The one send, and whether the page's last error is one this form's command left. */
export type QuickEditCommands = {
  sendChangedFieldsAsUpdate: (formValues: SchemaFormValues) => Promise<void>;
  isTheErrorOfThePageFromThisForm: boolean;
};

/**
 * The command of "Edição rápida", and what the form does once it is answered: "Atualizar"
 * (or "Atualizar prévia" for a loaded preview) sends `updateInstanceData` for the loaded
 * instance's id only, with the fields the operator changed (react-hook-form's
 * dirtyFields). Accepted, the form is filled from that instance again, read from the
 * store at that moment (the server sends the changed instances before its "ok",
 * webSocketHub.ts), so every field counts as untouched. Since BAJAOVRLAY-37 this is the
 * panel's only command: it never takes or previews anything new.
 *
 * A refusal is shown under the button only while it is the one this form's own last
 * command got: the item editor sends `updateInstanceData` too, and the page keeps one
 * "last command error" for everybody. What could go wrong: when another part of the page
 * is refused afterwards, this form's message goes away although nothing here succeeded.
 */
export function useQuickEditCommands(options: QuickEditCommandsOptions): QuickEditCommands {
  const { description, form, instanceBeingEdited, fieldsTheOperatorChanged } = options;
  const readServerStateNow = useReadServerStateNow();
  const sendCommand = useSendCommand();

  const lastCommandErrorOfThePage = useServerState((state) => state.lastCommandError);
  const [errorOfTheLastCommandFromThisForm, setErrorOfTheLastCommandFromThisForm] =
    useState<typeof lastCommandErrorOfThePage>(null);
  const isTheErrorOfThePageFromThisForm =
    lastCommandErrorOfThePage !== null &&
    lastCommandErrorOfThePage === errorOfTheLastCommandFromThisForm;

  // Not accepted (refused, no answer in time, no connection): the error the page has just
  // been left with is this command's, because the store is written before the answer
  // reaches the form (serverConnection.ts), so it is remembered as this form's.
  function rememberHowTheCommandEnded(wasAcceptedByTheServer: boolean): void {
    const errorLeftByThisCommand = wasAcceptedByTheServer
      ? null
      : readServerStateNow().lastCommandError;
    setErrorOfTheLastCommandFromThisForm(errorLeftByThisCommand);
  }

  async function sendChangedFieldsAsUpdate(formValues: SchemaFormValues): Promise<void> {
    const update = buildInstanceUpdateFromDirtySchemaFormFields(
      description,
      formValues,
      fieldsTheOperatorChanged,
    );
    // Nothing changed: nothing is said to the server and the air is left as it is.
    if (update.hasNothingToSend) {
      return;
    }
    // A press that races another operator's "Limpar" still names that id; the server then
    // refuses with its "not found" message, shown next to the button.
    const wasAcceptedByTheServer = await sendCommand({
      type: 'updateInstanceData',
      instanceId: instanceBeingEdited.id,
      data: update.data,
      takeTimeFieldKeys: update.takeTimeFieldKeys,
    });
    rememberHowTheCommandEnded(wasAcceptedByTheServer);
    const instanceNow = readServerStateNow().instances.find(
      (instance) => instance.id === instanceBeingEdited.id,
    );
    if (wasAcceptedByTheServer && instanceNow !== undefined) {
      const formValuesOfTheInstance = buildSchemaFormValuesFromDataOnAir(
        description,
        instanceNow.resolvedData,
      );
      form.reset(formValuesOfTheInstance.formValues);
    }
  }

  return { sendChangedFieldsAsUpdate, isTheErrorOfThePageFromThisForm };
}

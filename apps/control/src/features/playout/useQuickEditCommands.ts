import type { Graphic, Instance } from '@bajaovrlay/shared';
import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { useItemEditorTarget } from '@/features/items/ItemEditorTargetProvider';
import {
  buildInstanceUpdateFromDirtySchemaFormFields,
  buildSchemaFormValuesFromDataOnAir,
  buildTakeDataFromSchemaForm,
  type SchemaFormDescription,
  type SchemaFormValues,
} from '@/features/schemaForm';
import {
  useReadServerStateNow,
  useSendCommand,
  useServerState,
} from '@/state/ControlPageStateProvider';

import { buildItemSavedFromQuickEdit } from './itemSavedFromQuickEdit';
import { useQuickEditChoice } from './QuickEditChoiceProvider';

/** What the commands of "Edição rápida" are built from. */
export type QuickEditCommandsOptions = {
  graphic: Graphic;
  description: SchemaFormDescription;
  form: UseFormReturn<SchemaFormValues>;
  /** The loaded instance, in its newest copy, or undefined for a new entry. */
  instanceBeingEdited: Instance | undefined;
  /** The loaded instance's layer, or the layer chosen for a new entry. */
  layerIdOfTheCommands: string;
  /**
   * react-hook-form's `dirtyFields` as read while the form was drawn. Read there and not
   * at the press: react-hook-form keeps up to date only the parts of `formState` a
   * component reads as it draws, and that copy is what "changed" means for "Atualizar".
   */
  fieldsTheOperatorChanged: UseFormReturn<SchemaFormValues>['formState']['dirtyFields'];
};

/** The three sends, and whether the page's last error is one this form's command left. */
export type QuickEditCommands = {
  sendFormAsTake: (formValues: SchemaFormValues) => Promise<void>;
  sendFormAsPreview: (formValues: SchemaFormValues) => Promise<void>;
  sendChangedFieldsAsUpdate: (formValues: SchemaFormValues) => Promise<void>;
  /** "Salvar como item": opens the item editor prefilled; sends nothing itself. */
  openItemEditorWithTheForm: (formValues: SchemaFormValues) => void;
  isTheErrorOfThePageFromThisForm: boolean;
};

/**
 * The commands of "Edição rápida", and what the form does once each is answered.
 *
 * - "Colocar no ar": `takeGraphic` of the whole form on the layer of the commands. Once
 *   accepted, the panel edits the program instance that take made on that layer: it is
 *   the operator's own press, so this is not a silent move.
 * - "Prévia": `previewGraphic` of the same data on the same layer. Accepted, it changes
 *   nothing on air, so the form is NOT refilled and an unsent edit stays unsent. While a
 *   preview is loaded the new preview replaced it, so the panel edits the new one.
 * - "Salvar como item": no command. It opens the page's item editor prefilled with the
 *   graphic, the layer of the commands and the form (itemSavedFromQuickEdit.ts); the
 *   operator gives the label and "Onde" there and the editor sends createItem.
 * - "Atualizar": `updateInstanceData` for the loaded instance's id only, with the fields
 *   the operator changed (react-hook-form's dirtyFields). Accepted, the form is filled
 *   from that instance again, so every field counts as untouched.
 *
 * After an accepted command the instance is read from the store at that moment: the
 * server sends the changed instances before its "ok" (webSocketHub.ts).
 *
 * A refusal is shown under these buttons only while it is the one this form's own last
 * command got: the item editor sends `updateInstanceData` too, and the page keeps one
 * "last command error" for everybody. What could go wrong: when another part of the page
 * is refused afterwards, this form's message goes away although nothing here succeeded.
 */
export function useQuickEditCommands(options: QuickEditCommandsOptions): QuickEditCommands {
  const { graphic, description, form, instanceBeingEdited, layerIdOfTheCommands } = options;
  const { fieldsTheOperatorChanged } = options;
  const readServerStateNow = useReadServerStateNow();
  const sendCommand = useSendCommand();
  const { editInstanceMadeByThePanel, forgetTheLostTarget } = useQuickEditChoice();
  const { openItemEditorForNewItem } = useItemEditorTarget();
  const rundowns = useServerState((state) => state.rundowns);
  const panels = useServerState((state) => state.quickFirePanels);

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

  // Fills every field from what an instance holds, so none counts as changed.
  function fillFormFromInstance(instance: Instance): void {
    const formValues = buildSchemaFormValuesFromDataOnAir(description, instance.resolvedData);
    form.reset(formValues.formValues);
  }

  // The instance this panel's accepted command has just put on that layer and output.
  function findInstanceTheCommandMade(output: Instance['target']): Instance | undefined {
    return readServerStateNow().instances.find(
      (instance) =>
        instance.layerId === layerIdOfTheCommands &&
        instance.target === output &&
        instance.graphicId === graphic.id,
    );
  }

  // The panel goes on with the instance its own command made, and the form shows it.
  function editTheInstanceTheCommandMade(output: Instance['target']): void {
    const instanceMade = findInstanceTheCommandMade(output);
    if (instanceMade === undefined) {
      return;
    }
    editInstanceMadeByThePanel(instanceMade);
    fillFormFromInstance(instanceMade);
  }

  // A send from a new entry is the operator acting on the line about an instance that is
  // gone, so the line goes, whatever the server answers. Decided in BAJAOVRLAY-36: a
  // command from elsewhere on the page leaves it, since only this panel and "Editar"
  // write what the panel works on.
  function forgetTheLostTargetWhenSendingANewEntry(): void {
    if (instanceBeingEdited === undefined) {
      forgetTheLostTarget();
    }
  }

  async function sendFormAsTake(formValues: SchemaFormValues): Promise<void> {
    forgetTheLostTargetWhenSendingANewEntry();
    const takeData = buildTakeDataFromSchemaForm(description, formValues);
    const wasAcceptedByTheServer = await sendCommand({
      type: 'takeGraphic',
      graphicId: graphic.id,
      layerId: layerIdOfTheCommands,
      data: takeData.data,
      takeTimeFieldKeys: takeData.takeTimeFieldKeys,
    });
    rememberHowTheCommandEnded(wasAcceptedByTheServer);
    if (wasAcceptedByTheServer) {
      editTheInstanceTheCommandMade('program');
    }
  }

  async function sendFormAsPreview(formValues: SchemaFormValues): Promise<void> {
    forgetTheLostTargetWhenSendingANewEntry();
    const previewData = buildTakeDataFromSchemaForm(description, formValues);
    const wasAcceptedByTheServer = await sendCommand({
      type: 'previewGraphic',
      graphicId: graphic.id,
      layerId: layerIdOfTheCommands,
      data: previewData.data,
      takeTimeFieldKeys: previewData.takeTimeFieldKeys,
    });
    rememberHowTheCommandEnded(wasAcceptedByTheServer);
    const wasEditingAPreview = instanceBeingEdited?.target === 'preview';
    if (wasAcceptedByTheServer && wasEditingAPreview) {
      editTheInstanceTheCommandMade('preview');
    }
  }

  async function sendChangedFieldsAsUpdate(formValues: SchemaFormValues): Promise<void> {
    // "Atualizar" is drawn only while an instance is loaded, so a press always finds it.
    // A press that races another operator's "Limpar" still names that id; the server then
    // refuses with its "not found" message, shown next to the buttons.
    if (instanceBeingEdited === undefined) {
      return;
    }
    const update = buildInstanceUpdateFromDirtySchemaFormFields(
      description,
      formValues,
      fieldsTheOperatorChanged,
    );
    // Nothing changed: nothing is said to the server and the air is left as it is.
    if (update.hasNothingToSend) {
      return;
    }
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
      fillFormFromInstance(instanceNow);
    }
  }

  function openItemEditorWithTheForm(formValues: SchemaFormValues): void {
    const itemSaved = buildItemSavedFromQuickEdit(
      { description, graphicId: graphic.id, layerId: layerIdOfTheCommands, formValues },
      rundowns,
      panels,
    );
    openItemEditorForNewItem(itemSaved.home, itemSaved.prefill);
  }

  return {
    sendFormAsTake,
    openItemEditorWithTheForm,
    sendFormAsPreview,
    sendChangedFieldsAsUpdate,
    isTheErrorOfThePageFromThisForm,
  };
}

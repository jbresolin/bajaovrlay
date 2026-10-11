import type { Graphic } from '@bajaovrlay/shared';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { CardContent, CardFooter } from '@/components/ui/card';
import { ActionButton } from '@/features/connection/ActionButton';
import {
  buildEmptySchemaFormValues,
  buildInstanceUpdateFromDirtySchemaFormFields,
  buildSchemaFormResolver,
  buildSchemaFormValuesFromDataOnAir,
  buildTakeDataFromSchemaForm,
  describeSchemaFormFromDataSchema,
  SchemaFormFields,
  type SchemaFormValues,
} from '@/features/schemaForm';
import { ptBR } from '@/i18n/ptBR';
import {
  useReadServerStateNow,
  useSendCommand,
  useServerState,
} from '@/state/ControlPageStateProvider';

import { CommandErrorMessage } from './CommandErrorMessage';
import { findInstanceOfGraphicToFollow } from './instanceOfGraphicToFollow';

// The start of every element id of this form. The item editor draws a generated form on
// the same page, and with equal ids its labels would point at this panel's controls.
const controlIdPrefixOfQuickEdit = 'quick-edit-field';

/** What the form needs: the graphic it is for, and a way to say "the operator is editing". */
export type QuickEditFormProps = {
  graphic: Graphic;
  /**
   * Called with this graphic's id when the operator changes a field, so the panel stays
   * on this graphic. Must be the same function on every draw (a state setter is).
   */
  onOperatorChangedAFieldOfGraphic: (graphicId: string) => void;
};

/**
 * The form of one graphic in "Edição rápida", generated from the graphic's manifest
 * (features/schemaForm), with its two actions. "Colocar no ar" sends `takeGraphic` for
 * the graphic's default layer with the form as it stands, and the server replaces
 * whatever is on that layer. "Atualizar", drawn only while the graphic is on air, sends
 * `updateInstanceData` for the instance on air with only the fields the operator changed;
 * the server keeps the instance, so the graphic changes in place without leaving the screen.
 *
 * The graphic on air is found by its id on the program output, on ANY layer
 * (instanceOfGraphicToFollow.ts). If it is on air twice the form follows the one taken
 * most recently and says so in a line. What could go wrong: "Colocar no ar" does not
 * follow the instance on air, so with the graphic on another layer it puts a second one
 * on the default layer, and the form then follows that one.
 *
 * "Changed" is react-hook-form's `dirtyFields`: a field that differs from the value the
 * form was last filled with. So the form is filled from what is on air whenever that
 * changes, and again after every command the server accepts. A field the server fills
 * with the moment of the command ("Momento da entrada no ar") is named in the command's
 * `takeTimeFieldKeys`; this page never reads its own clock to build data.
 *
 * The panel draws this component with the graphic's id as its React `key`, so choosing
 * another graphic starts a fresh form. What could go wrong: a graphic whose package is
 * rebuilt with another schema while the page is open keeps the values of the old form
 * until the page is reloaded.
 */
export function QuickEditForm(props: QuickEditFormProps) {
  const { graphic, onOperatorChangedAFieldOfGraphic } = props;
  const graphicId = graphic.id;
  const instances = useServerState((state) => state.instances);
  const layers = useServerState((state) => state.layers);
  const readServerStateNow = useReadServerStateNow();
  const sendCommand = useSendCommand();

  // Reading the manifest's schema gives a new description every time, and the effect
  // further down refills the form whenever its inputs change. `useMemo` keeps the
  // description the same object until the server sends the graphics again, so the form
  // is not refilled on every draw.
  const dataSchemaOfTheGraphic = graphic.manifest.schema;
  const description = useMemo(
    () => describeSchemaFormFromDataSchema(dataSchemaOfTheGraphic),
    [dataSchemaOfTheGraphic],
  );

  const instancesFound = findInstanceOfGraphicToFollow(instances, graphicId);
  const instanceOnAir = instancesFound.instanceToFollow;
  const isGraphicOnAir = instanceOnAir !== undefined;
  // With the graphic on air more than once the operator must be told which one the form
  // shows and "Atualizar" changes. The layer is named as the layer panel names it; a
  // layer the server no longer lists is named by its id.
  const isGraphicOnAirMoreThanOnce = instancesFound.numberOfInstancesOnProgram > 1;
  const layerOfTheInstanceFollowed = layers.find((layer) => layer.id === instanceOnAir?.layerId);
  const nameOfTheLayerFollowed = layerOfTheInstanceFollowed?.name ?? instanceOnAir?.layerId ?? '';

  // What the form shows of the instance on air, or undefined while the graphic is off
  // air. Worked out on every draw (it is a handful of fields) for the line that names
  // the fields that could not be read, and for the values the form starts with.
  const formValuesReadFromTheAir =
    instanceOnAir === undefined
      ? undefined
      : buildSchemaFormValuesFromDataOnAir(description, instanceOnAir.resolvedData);
  const labelsOfFieldsOnAirThatCouldNotBeRead =
    formValuesReadFromTheAir?.labelsOfFieldsThatCouldNotBeRead ?? [];

  // The form starts with what is on air when the graphic is on air at the first draw (a
  // page reload in the middle of a show), and with the manifest's defaults otherwise.
  // `useState` keeps the instance the first draw read, so the effect below can tell "this
  // is what the form already started with" from news that arrived later.
  const [instanceOnAirAtFirstDraw] = useState(instanceOnAir);
  const form = useForm<SchemaFormValues>({
    // react-hook-form uses these at the first draw only.
    defaultValues: formValuesReadFromTheAir?.formValues ?? buildEmptySchemaFormValues(description),
    resolver: buildSchemaFormResolver(description),
  });
  const resetForm = form.reset;
  // Read here, while drawing, and not inside the button handler: react-hook-form keeps
  // up to date only the parts of `formState` a component reads as it draws.
  const fieldsTheOperatorChanged = form.formState.dirtyFields;
  const hasTheOperatorChangedAField = form.formState.isDirty;

  // While a press is being checked and its command waits for the server's answer both
  // buttons are off, so an impatient second click cannot send the graphic to air twice.
  // The form keeps this flag itself instead of reading react-hook-form's `isSubmitting`:
  // every `reset` switches that one off, and the form is reset whenever news about the
  // graphic arrives, which can be in the middle of the wait.
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);
  // A refusal is shown only once this form has sent something: the item editor sends
  // `updateInstanceData` too, and its refusals are shown there, not under these buttons.
  const [hasSentACommandFromThisForm, setHasSentACommandFromThisForm] = useState(false);

  // An operator who started editing must not have the form swapped for another graphic's
  // by a take from the rundown, so the panel is told at the first change.
  useEffect(() => {
    if (hasTheOperatorChangedAField) {
      onOperatorChangedAFieldOfGraphic(graphicId);
    }
  }, [hasTheOperatorChangedAField, onOperatorChangedAFieldOfGraphic, graphicId]);

  // Whenever what is on air changes (this graphic has just been taken from the rundown, or
  // another operator changed it) the form follows it. `keepDirtyValues` is what protects
  // an edit the operator has not sent yet: changed fields keep their value, untouched
  // fields take the on-air value. With the graphic off air the form is left as it is, so
  // the operator can put the same thing back with "Colocar no ar". `keepErrors` keeps the
  // message under a badly typed field next to its text, and `keepIsSubmitted` keeps the
  // form checking that field again as the operator corrects it. What could go wrong:
  // react-hook-form works out again which fields differ from the air only at the
  // operator's next change to any field, not when the news arrives. Until then a field
  // counts as changed even if the air has come to hold the very value the operator
  // typed, so an "Atualizar" pressed straight away sends it once more (the server then
  // changes nothing). And a message under an untouched field stays after someone else
  // corrects that value on air, until this operator's next press.
  // The first draw is left out because the form already started with those values, and
  // for a second reason: a dropdown (Radix Select) whose value changes in the very moment
  // it appears on the page, before it knows its options, reports "nothing chosen" back to
  // the form and so empties the field.
  // The effect runs when the instance or the description is another object, which is
  // when the server sent the instances or the graphics again; the store keeps both the
  // same between messages, so the form is not refilled on every draw.
  useEffect(() => {
    const isWhatTheFormStartedWith = instanceOnAir === instanceOnAirAtFirstDraw;
    if (instanceOnAir === undefined || isWhatTheFormStartedWith) {
      return;
    }
    const formValuesOnAir = buildSchemaFormValuesFromDataOnAir(
      description,
      instanceOnAir.resolvedData,
    );
    resetForm(formValuesOnAir.formValues, {
      keepDirtyValues: true,
      keepErrors: true,
      keepIsSubmitted: true,
    });
  }, [instanceOnAir, instanceOnAirAtFirstDraw, description, resetForm]);

  // After a command the server accepted nothing in the form is an unsent edit any more,
  // so every field is filled from what is on air and counts as untouched again. The
  // instance is read from the store at this moment, not taken from the last drawing: the
  // server sends the changed instances before its "ok" (webSocketHub.ts), so the store
  // already holds the instance this command created or changed. If the graphic is not on
  // air at that moment (someone cleared it in between) the form is left alone.
  function fillFormFromWhatIsOnAirNow(): void {
    const instanceOnAirNow = findInstanceOfGraphicToFollow(
      readServerStateNow().instances,
      graphicId,
    ).instanceToFollow;
    if (instanceOnAirNow === undefined) {
      return;
    }
    const formValuesOnAirNow = buildSchemaFormValuesFromDataOnAir(
      description,
      instanceOnAirNow.resolvedData,
    );
    resetForm(formValuesOnAirNow.formValues);
  }

  // Both functions run only when every field passed its rule; otherwise react-hook-form
  // puts the messages under the fields and neither is called.
  async function sendFormAsTakeCommand(formValues: SchemaFormValues): Promise<void> {
    const takeData = buildTakeDataFromSchemaForm(description, formValues);
    setHasSentACommandFromThisForm(true);
    const wasAcceptedByTheServer = await sendCommand({
      type: 'takeGraphic',
      graphicId,
      layerId: graphic.defaultLayerId,
      data: takeData.data,
      takeTimeFieldKeys: takeData.takeTimeFieldKeys,
    });
    if (wasAcceptedByTheServer) {
      fillFormFromWhatIsOnAirNow();
    }
  }
  async function sendChangedFieldsAsUpdateCommand(formValues: SchemaFormValues): Promise<void> {
    // This check is here only because the type allows undefined: "Atualizar" is drawn
    // only while the graphic is on air, so a press always finds the instance of that same
    // drawing. What can go wrong: a press that races another operator's "Limpar" still
    // names that instance; the server then refuses with its "not found" message, shown
    // next to the buttons, and the graphic stays off air.
    if (instanceOnAir === undefined) {
      return;
    }
    const update = buildInstanceUpdateFromDirtySchemaFormFields(
      description,
      formValues,
      fieldsTheOperatorChanged,
    );
    // Nothing changed: there is nothing to say to the server, and the graphic on air is
    // left exactly as it is. The press does nothing the operator can see.
    if (update.hasNothingToSend) {
      return;
    }

    setHasSentACommandFromThisForm(true);
    const wasAcceptedByTheServer = await sendCommand({
      type: 'updateInstanceData',
      instanceId: instanceOnAir.id,
      data: update.data,
      takeTimeFieldKeys: update.takeTimeFieldKeys,
    });
    if (wasAcceptedByTheServer) {
      fillFormFromWhatIsOnAirNow();
    }
  }
  const checkFormThenTake = form.handleSubmit(sendFormAsTakeCommand);
  const checkFormThenUpdate = form.handleSubmit(sendChangedFieldsAsUpdateCommand);

  // What a press on either button does: both buttons go off, the form is checked and, if
  // it passes, sent; the buttons come back whatever the outcome (accepted, refused, no
  // answer within 5 s, or a field that failed its rule).
  async function runWithBothButtonsOff(checkFormThenSend: () => Promise<void>): Promise<void> {
    setIsWaitingForTheServer(true);
    try {
      await checkFormThenSend();
    } finally {
      setIsWaitingForTheServer(false);
    }
  }

  return (
    // The buttons are plain buttons, not submit buttons, and the form's own submit is
    // cancelled: pressing Enter in a text field must never put a graphic on air.
    <form onSubmit={(event) => event.preventDefault()} noValidate className="contents">
      <CardContent className="flex flex-col gap-3">
        {isGraphicOnAirMoreThanOnce && (
          <p role="status" className="text-sm text-muted-foreground">
            {ptBR.playout.quickEdit.followingMostRecentInstance(
              graphic.manifest.name,
              instancesFound.numberOfInstancesOnProgram,
              nameOfTheLayerFollowed,
            )}
          </p>
        )}
        {labelsOfFieldsOnAirThatCouldNotBeRead.length > 0 && (
          <p role="status" className="text-sm text-muted-foreground">
            {ptBR.playout.quickEdit.fieldsOnAirThatCouldNotBeRead(
              labelsOfFieldsOnAirThatCouldNotBeRead.join(', '),
            )}
          </p>
        )}
        <SchemaFormFields
          form={form}
          description={description}
          controlIdPrefix={controlIdPrefixOfQuickEdit}
        />
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-3">
        <ActionButton
          type="button"
          disabled={isWaitingForTheServer}
          onClick={() => runWithBothButtonsOff(checkFormThenTake)}
        >
          {ptBR.playout.takeButton}
        </ActionButton>
        {isGraphicOnAir && (
          <ActionButton
            type="button"
            variant="secondary"
            disabled={isWaitingForTheServer}
            onClick={() => runWithBothButtonsOff(checkFormThenUpdate)}
          >
            {ptBR.playout.updateButton}
          </ActionButton>
        )}
        {hasSentACommandFromThisForm && (
          <CommandErrorMessage commandTypes={['takeGraphic', 'updateInstanceData']} />
        )}
      </CardFooter>
    </form>
  );
}

import type { Graphic, Instance } from '@bajaovrlay/shared';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { CardContent, CardFooter } from '@/components/ui/card';
import {
  buildEmptySchemaFormValues,
  buildSchemaFormResolver,
  buildSchemaFormValuesFromDataOnAir,
  describeSchemaFormFromDataSchema,
  SchemaFormFields,
  type SchemaFormValues,
} from '@/features/schemaForm';
import { ptBR } from '@/i18n/ptBR';

import { findClockFieldKeysOfGraphic } from './clockFieldsOfGraphic';
import { QuickEditButtons } from './QuickEditButtons';
import { useQuickEditCommands } from './useQuickEditCommands';
import { useTimeOnScreenInQuickEdit } from './useTimeOnScreenInQuickEdit';

// The start of every element id of this form. The item editor draws a generated form on
// the same page, and with equal ids its labels would point at this panel's controls.
const controlIdPrefixOfQuickEdit = 'quick-edit-field';

/** What the form needs: its graphic, the instance loaded (if any) and where to send. */
export type QuickEditFormProps = {
  graphic: Graphic;
  /** The instance loaded from "Camadas", in its newest copy, or undefined for a new entry. */
  instanceBeingEdited: Instance | undefined;
  /** The loaded instance's layer, or the layer chosen for a new entry. */
  layerIdOfTheCommands: string;
};

/**
 * The form of one graphic in "Edição rápida", generated from the graphic's manifest
 * (features/schemaForm), with its buttons (QuickEditButtons.tsx) and their commands
 * (useQuickEditCommands.ts). "Colocar no ar" and "Prévia" send the form as it stands to
 * the layer of the commands. "Atualizar", drawn only while an instance on air is loaded,
 * sends `updateInstanceData` for THAT instance's id with only the fields the operator
 * changed; the server keeps the instance, so the graphic changes in place.
 *
 * "Changed" is react-hook-form's `dirtyFields`: a field that differs from the value the
 * form was last filled with. So while an instance is loaded the form is filled from it
 * whenever it changes, and again after every command the server accepts. A new entry is
 * never filled from the air. A field the server fills with the moment of the command
 * ("Momento da entrada no ar") is named in the command's `takeTimeFieldKeys`; this page
 * never reads its own clock to build data.
 *
 * One field may show something the form does not hold: for a graphic whose manifest
 * describes a clock (clockFieldsOfGraphic.ts), the untouched time field of a loaded clock
 * shows the time on screen right now (useTimeOnScreenInQuickEdit.ts) while the form goes
 * on holding the reading of the instance. So that field stays "unchanged": "Atualizar"
 * does not send it, and "Colocar no ar" sends the reading as it is, time and moment
 * together, which puts the same clock on screen without a jump.
 *
 * The panel draws this component with a React `key` that changes at every "Editar" and
 * every graphic chosen, so those start a fresh form. When the loaded instance goes, the
 * key stays and so does everything typed. What could go wrong: a graphic whose package
 * is rebuilt with another schema while the page is open keeps the values of the old form
 * until the page is reloaded.
 */
export function QuickEditForm(props: QuickEditFormProps) {
  const { graphic, instanceBeingEdited, layerIdOfTheCommands } = props;

  // Reading the manifest's schema gives a new description every time, and the effect
  // further down refills the form whenever its inputs change. `useMemo` keeps the
  // description the same object until the server sends the graphics again, so the form
  // is not refilled on every draw.
  const dataSchemaOfTheGraphic = graphic.manifest.schema;
  const description = useMemo(
    () => describeSchemaFormFromDataSchema(dataSchemaOfTheGraphic),
    [dataSchemaOfTheGraphic],
  );

  // What the form shows of the loaded instance, or undefined for a new entry. Worked out
  // on every draw (it is a handful of fields) for the line that names the fields that
  // could not be read, and for the values the form starts with.
  const formValuesReadFromTheInstance =
    instanceBeingEdited === undefined
      ? undefined
      : buildSchemaFormValuesFromDataOnAir(description, instanceBeingEdited.resolvedData);
  const labelsOfFieldsOnAirThatCouldNotBeRead =
    formValuesReadFromTheInstance?.labelsOfFieldsThatCouldNotBeRead ?? [];

  // The form starts with what the loaded instance holds ("Editar" draws a fresh form),
  // and with the manifest's defaults for a new entry. `useState` keeps the instance the
  // first draw read, so the effect below can tell "this is what the form already started
  // with" from news that arrived later.
  const [instanceAtFirstDraw] = useState(instanceBeingEdited);
  const form = useForm<SchemaFormValues>({
    // react-hook-form uses these at the first draw only.
    defaultValues:
      formValuesReadFromTheInstance?.formValues ?? buildEmptySchemaFormValues(description),
    resolver: buildSchemaFormResolver(description),
  });
  const resetForm = form.reset;
  // Read here, while drawing, and not inside the button handler: react-hook-form keeps
  // up to date only the parts of `formState` a component reads as it draws.
  const fieldsTheOperatorChanged = form.formState.dirtyFields;
  // Read for its side effect, and kept on purpose: react-hook-form works out EVERY field's
  // "changed" flag again, at the operator's next change, only while some component reads
  // `isDirty`. Without it a field cleared here and since taken off air by someone else
  // would stay "changed" and "Atualizar" would send it as null again
  // (QuickEditPanelOtherOperator.test.tsx proves this).
  void form.formState.isDirty;

  // The time on screen for the time field of a loaded clock; undefined for every other
  // graphic, for a new entry, and once the operator changed the clock's time or moment.
  const timeOnScreenForTheTimeField = useTimeOnScreenInQuickEdit({
    clockFieldKeys: findClockFieldKeysOfGraphic(graphic.manifest.v_baja?.updateRule, description),
    dataOnAir: instanceBeingEdited?.resolvedData,
    fieldsTheOperatorChanged,
  });

  const commands = useQuickEditCommands({
    graphic,
    description,
    form,
    instanceBeingEdited,
    layerIdOfTheCommands,
    fieldsTheOperatorChanged,
  });

  // While a press is being checked and its command waits for the server's answer every
  // button is off, so an impatient second click cannot send the graphic to air twice.
  // The form keeps this flag itself instead of reading react-hook-form's `isSubmitting`:
  // every `reset` switches that one off, and the form is reset whenever news about the
  // graphic arrives, which can be in the middle of the wait.
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);

  // Whenever the loaded instance changes (another operator changed it, or this form's own
  // command was accepted) the form follows it. `keepDirtyValues` is what protects an edit
  // the operator has not sent yet: changed fields keep their value, untouched fields take
  // the instance's value. With no instance loaded (a new entry, or the loaded one gone)
  // the form is left as it is, so "Colocar no ar" puts the same thing back. `keepErrors`
  // keeps the message under a badly typed field next to its text, and `keepIsSubmitted` keeps the
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
    const isWhatTheFormStartedWith = instanceBeingEdited === instanceAtFirstDraw;
    if (instanceBeingEdited === undefined || isWhatTheFormStartedWith) {
      return;
    }
    const formValuesOfTheInstance = buildSchemaFormValuesFromDataOnAir(
      description,
      instanceBeingEdited.resolvedData,
    );
    resetForm(formValuesOfTheInstance.formValues, {
      keepDirtyValues: true,
      keepErrors: true,
      keepIsSubmitted: true,
    });
  }, [instanceBeingEdited, instanceAtFirstDraw, description, resetForm]);

  // Each runs its command only when every field passed its rule; otherwise
  // react-hook-form puts the messages under the fields and sends nothing.
  const checkFormThenTake = form.handleSubmit(commands.sendFormAsTake);
  const checkFormThenPreview = form.handleSubmit(commands.sendFormAsPreview);
  const checkFormThenUpdate = form.handleSubmit(commands.sendChangedFieldsAsUpdate);
  const checkFormThenOpenItemEditor = form.handleSubmit(commands.openItemEditorWithTheForm);

  // What a press on any of the buttons does: all of them go off, the form is checked
  // and, if it passes, sent; the buttons come back whatever the outcome (accepted,
  // refused, no answer within 5 s, or a field that failed its rule).
  async function runWithEveryButtonOff(checkFormThenSend: () => Promise<void>): Promise<void> {
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
        {labelsOfFieldsOnAirThatCouldNotBeRead.length > 0 && (
          <p role="status" className="text-sm text-muted-foreground">
            {describeFieldsThatCouldNotBeRead(
              instanceBeingEdited?.target,
              labelsOfFieldsOnAirThatCouldNotBeRead.join(', '),
            )}
          </p>
        )}
        <SchemaFormFields
          form={form}
          description={description}
          controlIdPrefix={controlIdPrefixOfQuickEdit}
          textShownInUntouchedField={timeOnScreenForTheTimeField}
        />
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-3">
        <QuickEditButtons
          isWaitingForTheServer={isWaitingForTheServer}
          isUpdateOffered={instanceBeingEdited?.target === 'program'}
          isTheErrorOfThePageFromThisForm={commands.isTheErrorOfThePageFromThisForm}
          onTakePressed={() => runWithEveryButtonOff(checkFormThenTake)}
          onPreviewPressed={() => runWithEveryButtonOff(checkFormThenPreview)}
          onUpdatePressed={() => runWithEveryButtonOff(checkFormThenUpdate)}
          onSaveAsItemPressed={() => void checkFormThenOpenItemEditor()}
        />
      </CardFooter>
    </form>
  );
}

/**
 * The line naming the fields the form could not read from the loaded instance, in the
 * words of the buttons that instance has: a loaded preview has "Prévia" in place of
 * "Atualizar", so its line must not promise what "Atualizar" does.
 */
function describeFieldsThatCouldNotBeRead(
  outputOfTheInstance: Instance['target'] | undefined,
  fieldLabels: string,
): string {
  if (outputOfTheInstance === 'preview') {
    return ptBR.playout.quickEdit.fieldsInPreviewThatCouldNotBeRead(fieldLabels);
  }
  return ptBR.playout.quickEdit.fieldsOnAirThatCouldNotBeRead(fieldLabels);
}

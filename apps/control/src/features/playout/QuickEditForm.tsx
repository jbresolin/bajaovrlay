import type { Graphic, Instance } from '@bajaovrlay/shared';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { CardContent, CardFooter } from '@/components/ui/card';
import {
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

/** What the form needs: its graphic and the instance loaded. */
export type QuickEditFormProps = {
  graphic: Graphic;
  /** The instance loaded from "Camadas", in its newest copy: on air, or in preview. */
  instanceBeingEdited: Instance;
};

/**
 * The form of one graphic in "Edição rápida", generated from the graphic's manifest
 * (features/schemaForm), with its button (QuickEditButtons.tsx) and its command
 * (useQuickEditCommands.ts). "Atualizar" ("Atualizar prévia" for a preview) sends
 * `updateInstanceData` for THAT instance's id with only the fields the operator changed;
 * the server keeps the instance, so the graphic changes in place.
 *
 * "Changed" is react-hook-form's `dirtyFields`: a field that differs from the value the
 * form was last filled with. So while an instance is loaded the form is filled from it
 * whenever it changes, and again after every command the server accepts. A field the
 * server fills with the moment of the command
 * ("Momento da entrada no ar") is named in the command's `takeTimeFieldKeys`; this page
 * never reads its own clock to build data.
 *
 * One field may show something the form does not hold: for a graphic whose manifest
 * describes a clock (clockFieldsOfGraphic.ts), the untouched time field of a loaded clock
 * shows the time on screen right now (useTimeOnScreenInQuickEdit.ts) while the form goes
 * on holding the reading of the instance. So that field stays "unchanged": "Atualizar"
 * does not send it.
 *
 * The panel draws this component with a React `key` that changes at every "Editar", so
 * each press starts a fresh form; when the loaded instance goes, the panel draws no form
 * at all. What could go wrong: a graphic whose package is rebuilt with another schema
 * while the page is open keeps the values of the old form until the next "Editar".
 */
export function QuickEditForm(props: QuickEditFormProps) {
  const { graphic, instanceBeingEdited } = props;

  // Reading the manifest's schema gives a new description every time, and the effect
  // further down refills the form whenever its inputs change. `useMemo` keeps the
  // description the same object until the server sends the graphics again, so the form
  // is not refilled on every draw.
  const dataSchemaOfTheGraphic = graphic.manifest.schema;
  const description = useMemo(
    () => describeSchemaFormFromDataSchema(dataSchemaOfTheGraphic),
    [dataSchemaOfTheGraphic],
  );

  // What the form shows of the loaded instance. Worked out on every draw (it is a handful
  // of fields) for the line that names the fields that could not be read, and for the
  // values the form starts with.
  const formValuesReadFromTheInstance = buildSchemaFormValuesFromDataOnAir(
    description,
    instanceBeingEdited.resolvedData,
  );
  const labelsOfFieldsOnAirThatCouldNotBeRead =
    formValuesReadFromTheInstance.labelsOfFieldsThatCouldNotBeRead;

  // The form starts with what the loaded instance holds ("Editar" draws a fresh form).
  // `useState` keeps the instance the first draw read, so the effect below can tell "this
  // is what the form already started with" from news that arrived later.
  const [instanceAtFirstDraw] = useState(instanceBeingEdited);
  const form = useForm<SchemaFormValues>({
    // react-hook-form uses these at the first draw only.
    defaultValues: formValuesReadFromTheInstance.formValues,
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
  // graphic, and once the operator changed the clock's time or moment.
  const timeOnScreenForTheTimeField = useTimeOnScreenInQuickEdit({
    clockFieldKeys: findClockFieldKeysOfGraphic(graphic.manifest.v_baja?.updateRule, description),
    dataOnAir: instanceBeingEdited.resolvedData,
    fieldsTheOperatorChanged,
  });

  const commands = useQuickEditCommands({
    description,
    form,
    instanceBeingEdited,
    fieldsTheOperatorChanged,
  });

  // While a press is being checked and its command waits for the server's answer the
  // button is off, so an impatient second click cannot send the same change twice.
  // The form keeps this flag itself instead of reading react-hook-form's `isSubmitting`:
  // every `reset` switches that one off, and the form is reset whenever news about the
  // graphic arrives, which can be in the middle of the wait.
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);

  // Whenever the loaded instance changes (another operator changed it, or this form's own
  // command was accepted) the form follows it. `keepDirtyValues` is what protects an edit
  // the operator has not sent yet: changed fields keep their value, untouched fields take
  // the instance's value. `keepErrors` keeps the message under a badly typed field next
  // to its text, and `keepIsSubmitted` keeps the form checking that field again as the
  // operator corrects it. What could go wrong:
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
    if (isWhatTheFormStartedWith) {
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

  // It runs its command only when every field passed its rule; otherwise react-hook-form
  // puts the messages under the fields and sends nothing.
  const checkFormThenUpdate = form.handleSubmit(commands.sendChangedFieldsAsUpdate);

  // What a press does: the button goes off, the form is checked and, if it passes, sent;
  // the button comes back whatever the outcome (accepted, refused, no answer within 5 s,
  // or a field that failed its rule).
  async function runWithTheButtonOff(checkFormThenSend: () => Promise<void>): Promise<void> {
    setIsWaitingForTheServer(true);
    try {
      await checkFormThenSend();
    } finally {
      setIsWaitingForTheServer(false);
    }
  }

  return (
    // The button is a plain button, not a submit button, and the form's own submit is
    // cancelled: pressing Enter in a text field must never change what is on air.
    <form onSubmit={(event) => event.preventDefault()} noValidate className="contents">
      <CardContent className="flex flex-col gap-3">
        {labelsOfFieldsOnAirThatCouldNotBeRead.length > 0 && (
          <p role="status" className="text-sm text-muted-foreground">
            {describeFieldsThatCouldNotBeRead(
              instanceBeingEdited.target,
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
          outputOfTheInstance={instanceBeingEdited.target}
          isTheErrorOfThePageFromThisForm={commands.isTheErrorOfThePageFromThisForm}
          onUpdatePressed={() => runWithTheButtonOff(checkFormThenUpdate)}
        />
      </CardFooter>
    </form>
  );
}

/**
 * The line naming the fields the form could not read from the loaded instance, in the
 * words of the button that instance has: "Atualizar", or "Atualizar prévia".
 */
function describeFieldsThatCouldNotBeRead(
  outputOfTheInstance: Instance['target'],
  fieldLabels: string,
): string {
  if (outputOfTheInstance === 'preview') {
    return ptBR.playout.quickEdit.fieldsInPreviewThatCouldNotBeRead(fieldLabels);
  }
  return ptBR.playout.quickEdit.fieldsOnAirThatCouldNotBeRead(fieldLabels);
}

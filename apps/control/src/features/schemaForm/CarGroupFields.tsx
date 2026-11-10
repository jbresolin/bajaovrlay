import type { CarGroup, EntityLibrary } from '@bajaovrlay/shared';
import { type UseFormReturn, useFormState, useWatch } from 'react-hook-form';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ptBR } from '@/i18n/ptBR';

import { emptySchemaFormBindingValue, readBindingFromSchemaFormValue } from './bindingFormValue';
import { BindingValueNowLine } from './BindingValueNowLine';
import { CarBattleSelect } from './CarBattleSelect';
import {
  canCarGroupBeReadFromTheEvent,
  type CarPickInForm,
  chooseCarGroupWayAfterSeparateFields,
  readAgreementOfCarGroupFields,
  readCarPickShownInGroup,
} from './carGroupChoice';
import {
  writeCarGroupFromTheEvent,
  writeCarGroupTypedByHand,
  writeCarGroupWay,
  writeCarPickIntoForm,
} from './carGroupFormWrites';
import { describeEventPathWithItsExample } from './eventFieldFormValue';
import {
  type AttributesOfTheGroupMessage,
  CarPickControls,
  type ControlOfTheGroupMessage,
} from './CarPickControls';
import type { SchemaFormBindingOptions } from './schemaFormBindingOptions';
import type { SchemaFormFieldDescription } from './schemaFormDescription';
import { SchemaFormFieldRow } from './SchemaFormFieldRow';
import type { SchemaFormValues } from './schemaFormValues';

const texts = ptBR.carGroups;
const wholeNumberFromOnePattern = /^[1-9]\d*$/;

/** One field of the group, with the element id its row would have had in the form. */
export type FieldOfCarGroup = { field: SchemaFormFieldDescription; controlId: string };

/**
 * One car group of the item editor (BAJAOVRLAY-66), drawn in place of the car's fields:
 * "Como escolher Carro da frente" (by number, by place, typed by hand), then for a pick
 * the source, the number or the place, "Ao vivo / Congelado" once for the whole car and
 * what each field reads now; typed by hand shows the car's fields together, typed only.
 * "Campos separados" shows each field's own row as before, and a line says why when the
 * fields do not follow one car; such fields stay separate until a way is chosen for them. On the car ahead of a battle, "Disputa pela posição" sets
 * this car and the one right behind it at once. On an event template (BAJAOVRLAY-67), a
 * fourth way, "Do evento", reads the car, team and school from the event, each field
 * listed with the sample event's value; offered only where every field has a payload
 * field of its meaning that fits it.
 * The picks are written into each field's kind and binding (carGroupFormWrites.ts), so the
 * form's check and the commands read the fields exactly as they always did.
 */
export function CarGroupFields(props: {
  form: UseFormReturn<SchemaFormValues>;
  carGroup: CarGroup;
  /** The group whose car runs right behind this one (the battle's car behind), if any. */
  carGroupRightBehind: CarGroup | undefined;
  fieldsOfTheGroup: FieldOfCarGroup[];
  dataSchema: unknown;
  bindingOptions: SchemaFormBindingOptions;
  entityLibrary: EntityLibrary | undefined;
  controlIdPrefix: string;
  isDisabled: boolean;
  onImageUploadingChange: ((fieldKey: string, isUploading: boolean) => void) | undefined;
}) {
  const { form, carGroup, fieldsOfTheGroup, bindingOptions, isDisabled } = props;
  const groupLabel = carGroup.label;
  const controlId = `${props.controlIdPrefix}-car-group-${carGroup.id}`;
  const fieldKeys = Object.keys(carGroup.fields);

  // Redraws this group when its way, or a kind or binding of its own fields, changes;
  // what is drawn is then read from the form as it is now.
  const way =
    useWatch({ control: form.control, name: `carGroupWays.${carGroup.id}` }) ?? 'notChosen';
  useWatch({
    control: form.control,
    name: fieldKeys.flatMap((fieldKey) => [`kinds.${fieldKey}`, `bindings.${fieldKey}`] as const),
  });
  const { errors } = useFormState({
    control: form.control,
    name: fieldKeys.map((fieldKey) => `values.${fieldKey}` as const),
  });
  const formValuesNow = form.getValues();

  const isPicked = way === 'carNumber' || way === 'place';
  const sampleEventPayload = bindingOptions.sampleEventPayload;
  const isFromTheEventOffered =
    sampleEventPayload !== undefined && canCarGroupBeReadFromTheEvent(carGroup, props.dataSchema);
  const pickShown: CarPickInForm | undefined = isPicked
    ? readCarPickShownInGroup(carGroup, formValuesNow, way === 'carNumber' ? 'number' : 'place')
    : undefined;

  /** The source a new pick starts on: the one shown, or the only source there is. */
  function chooseSourceForANewPick(sourceIdShown: string): string {
    const onlySource =
      bindingOptions.dataSources.length === 1 ? bindingOptions.dataSources[0] : undefined;
    return sourceIdShown === '' && onlySource !== undefined ? onlySource.id : sourceIdShown;
  }

  function chooseWay(chosenWay: string): void {
    if (chosenWay === 'typed') {
      writeCarGroupTypedByHand(form, carGroup);
      return;
    }
    if (chosenWay === 'fromTheEvent') {
      writeCarGroupFromTheEvent(form, carGroup);
      return;
    }
    const pickedBy = chosenWay === 'carNumber' ? 'number' : 'place';
    const pickBefore = readCarPickShownInGroup(carGroup, form.getValues(), pickedBy);
    writeCarPickIntoForm(form, carGroup, {
      ...pickBefore,
      sourceId: chooseSourceForANewPick(pickBefore.sourceId),
    });
  }

  // Fields that disagree stay separate when the switch is turned off (the switch stays
  // on): hiding them would hide mixed bindings a save still stores.
  function chooseSeparateFields(isSeparate: boolean): void {
    const wayAfter = isSeparate
      ? 'separate'
      : chooseCarGroupWayAfterSeparateFields(carGroup, form.getValues());
    writeCarGroupWay(form, carGroup, wayAfter);
  }

  const groupMessage = chooseGroupMessage();
  const groupMessageId = `${controlId}-message`;

  /**
   * The group's own message while a field of it shows one and its fields are hidden, with
   * the control it is about: what is missing in the pick, or else the first field's own
   * message (on the way). Typed and separate fields show their messages in their own rows.
   */
  function chooseGroupMessage(): GroupMessage | undefined {
    const firstMessage = fieldKeys
      .map((fieldKey) => errors.values?.[fieldKey]?.message)
      .find((message) => message !== undefined);
    if (firstMessage === undefined || way === 'typed' || way === 'separate') {
      return undefined;
    }
    if (way === 'fromTheEvent') {
      return { text: firstMessage, controlAbout: 'way' };
    }
    if (pickShown === undefined) {
      return { text: texts.wayMissing(groupLabel), controlAbout: 'way' };
    }
    if (pickShown.sourceId === '') {
      return { text: texts.sourceMissing(groupLabel), controlAbout: 'source' };
    }
    if (
      pickShown.pickedBy === 'number' &&
      !wholeNumberFromOnePattern.test(pickShown.carNumberText.trim())
    ) {
      return { text: texts.carNumberMissing(groupLabel), controlAbout: 'carNumber' };
    }
    if (pickShown.pickedBy === 'place' && pickShown.placeNumber === undefined) {
      return { text: texts.placeMissing(groupLabel), controlAbout: 'place' };
    }
    return { text: firstMessage, controlAbout: 'way' };
  }

  /** aria-invalid and aria-describedby for one control, set only when the message is its. */
  function describeControlWithTheMessage(
    control: ControlOfTheGroupMessage,
  ): AttributesOfTheGroupMessage {
    if (groupMessage?.controlAbout !== control) {
      return {};
    }
    return { 'aria-invalid': true, 'aria-describedby': groupMessageId };
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-2 rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-medium">{groupLabel}</legend>

      {props.carGroupRightBehind !== undefined && (
        <CarBattleSelect
          form={form}
          carGroupAhead={carGroup}
          carGroupBehind={props.carGroupRightBehind}
          chooseSourceForANewPick={chooseSourceForANewPick}
          isDisabled={isDisabled}
        />
      )}

      {/* Shown in "Campos separados" too: a way chosen there fills every field alike,
          which is how fields that disagree are grouped again. */}
      <Select
        value={way === 'notChosen' || way === 'separate' ? '' : way}
        onValueChange={chooseWay}
        disabled={isDisabled}
      >
        <SelectTrigger
          id={controlId}
          size="sm"
          className="w-full"
          aria-label={texts.wayLabel(groupLabel)}
          {...describeControlWithTheMessage('way')}
        >
          <SelectValue placeholder={ptBR.schemaForm.nothingChosenPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="carNumber">{texts.wayOptions.carNumber}</SelectItem>
          <SelectItem value="place">{texts.wayOptions.place}</SelectItem>
          <SelectItem value="typed">{texts.wayOptions.typed}</SelectItem>
          {isFromTheEventOffered || way === 'fromTheEvent' ? (
            <SelectItem value="fromTheEvent">{texts.wayOptions.fromTheEvent}</SelectItem>
          ) : null}
        </SelectContent>
      </Select>

      {pickShown !== undefined && (
        <CarPickControls
          pick={pickShown}
          groupLabel={groupLabel}
          controlId={controlId}
          bindingOptions={bindingOptions}
          isDisabled={isDisabled}
          describeControlWithTheMessage={describeControlWithTheMessage}
          onPickChanged={(pickAfter) => writeCarPickIntoForm(form, carGroup, pickAfter)}
        />
      )}

      {pickShown !== undefined && (
        <ul className="flex flex-col gap-1" aria-label={texts.valuesNowHeading}>
          {fieldsOfTheGroup.map(({ field }) => {
            const bindingRead = readBindingFromSchemaFormValue(
              field,
              formValuesNow.bindings[field.key] ?? emptySchemaFormBindingValue,
              props.dataSchema,
              false,
            );
            return (
              <li key={field.key} className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-xs">{field.label}</span>
                {bindingRead.status === 'binding' && (
                  <BindingValueNowLine
                    binding={bindingRead.binding}
                    bindingOptions={bindingOptions}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {way === 'fromTheEvent' && (
        <ul className="flex flex-col gap-1" aria-label={texts.valuesNowHeading}>
          {fieldsOfTheGroup.map(({ field }) => (
            <li key={field.key} className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-xs">{field.label}</span>
              {sampleEventPayload === undefined ? null : (
                <span className="text-xs text-muted-foreground">
                  {describeEventPathWithItsExample(
                    carGroup.fields[field.key] ?? '',
                    sampleEventPayload,
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {way === 'separate' && <SeparateFieldsNote carGroup={carGroup} formValues={formValuesNow} />}

      {(way === 'typed' || way === 'separate') && (
        <div className="grid grid-cols-2 gap-4">
          {fieldsOfTheGroup.map(({ field, controlId: fieldControlId }) => (
            <div key={field.key} className="col-span-2 sm:col-span-1">
              <SchemaFormFieldRow
                form={form}
                field={field}
                controlId={fieldControlId}
                isDisabled={isDisabled}
                textShownWhileUntouched={undefined}
                dataSchema={props.dataSchema}
                // Typed by hand offers the typed value only; separate offers every kind.
                bindingOptions={way === 'separate' ? bindingOptions : undefined}
                entityLibrary={way === 'separate' ? props.entityLibrary : undefined}
                isFilledByTheWholeClock={false}
                readOnlyContent={undefined}
                onImageUploadingChange={props.onImageUploadingChange}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Switch
          id={`${controlId}-separate`}
          checked={way === 'separate'}
          onCheckedChange={chooseSeparateFields}
          disabled={isDisabled}
          aria-label={texts.separateFieldsAccessibleName(groupLabel)}
        />
        <Label htmlFor={`${controlId}-separate`} className="text-xs font-normal">
          {texts.separateFieldsLabel}
        </Label>
      </div>

      {groupMessage !== undefined && (
        <p id={groupMessageId} role="alert" className="text-sm text-destructive">
          {groupMessage.text}
        </p>
      )}
    </fieldset>
  );
}

/** A group's message and the control it is about, which it describes. */
type GroupMessage = { text: string; controlAbout: ControlOfTheGroupMessage };

/**
 * The lines that say why a group's fields are separate, when they do not follow one car,
 * and how to group them again: choosing a way, which fills every field alike.
 */
function SeparateFieldsNote(props: { carGroup: CarGroup; formValues: SchemaFormValues }) {
  const agreement = readAgreementOfCarGroupFields(props.carGroup, props.formValues);
  const groupLabel = props.carGroup.label;
  let whyNote: string | undefined;
  if (agreement.status === 'differentCars') {
    whyNote = texts.differentCarsNote(groupLabel);
  } else if (agreement.status === 'notOnePick') {
    whyNote = texts.notOnePickNote(groupLabel);
  }
  if (whyNote === undefined) {
    return null;
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">{whyNote}</p>
      <p className="text-sm text-muted-foreground">{texts.chooseWayToGroupNote(groupLabel)}</p>
    </>
  );
}

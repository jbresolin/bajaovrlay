import {
  type CarGroup,
  type EntityLibrary,
  highestPlaceACarCanBePickedAt,
} from '@bajaovrlay/shared';
import { type UseFormReturn, useFormState, useWatch } from 'react-hook-form';

import { Input } from '@/components/ui/input';
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
  type CarPickInForm,
  chooseCarGroupWayAfterSeparateFields,
  readAgreementOfCarGroupFields,
  readCarPickShownInGroup,
} from './carGroupChoice';
import {
  writeCarGroupTypedByHand,
  writeCarGroupWay,
  writeCarPickIntoForm,
} from './carGroupFormWrites';
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
 * fields do not follow one car. On the car ahead of a battle, "Disputa pela posição" sets
 * this car and the one right behind it at once.
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
    const pickedBy = chosenWay === 'carNumber' ? 'number' : 'place';
    const pickBefore = readCarPickShownInGroup(carGroup, form.getValues(), pickedBy);
    writeCarPickIntoForm(form, carGroup, {
      ...pickBefore,
      sourceId: chooseSourceForANewPick(pickBefore.sourceId),
    });
  }

  function chooseSeparateFields(isSeparate: boolean): void {
    const wayAfter = isSeparate
      ? 'separate'
      : chooseCarGroupWayAfterSeparateFields(carGroup, form.getValues());
    writeCarGroupWay(form, carGroup, wayAfter);
  }

  const groupMessage = chooseGroupMessage();

  /**
   * The group's own message while a field of it shows one and its fields are hidden: what
   * is missing in the pick, or else the first field's own message. Typed and separate
   * fields show their messages in their own rows.
   */
  function chooseGroupMessage(): string | undefined {
    const firstMessage = fieldKeys
      .map((fieldKey) => errors.values?.[fieldKey]?.message)
      .find((message) => message !== undefined);
    if (firstMessage === undefined || way === 'typed' || way === 'separate') {
      return undefined;
    }
    if (pickShown === undefined) {
      return texts.wayMissing(groupLabel);
    }
    if (pickShown.sourceId === '') {
      return texts.sourceMissing(groupLabel);
    }
    if (
      pickShown.pickedBy === 'number' &&
      !wholeNumberFromOnePattern.test(pickShown.carNumberText.trim())
    ) {
      return texts.carNumberMissing(groupLabel);
    }
    if (pickShown.pickedBy === 'place' && pickShown.placeNumber === undefined) {
      return texts.placeMissing(groupLabel);
    }
    return firstMessage;
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

      {way !== 'separate' && (
        <Select
          value={way === 'notChosen' ? '' : way}
          onValueChange={chooseWay}
          disabled={isDisabled}
        >
          <SelectTrigger
            id={controlId}
            size="sm"
            className="w-full"
            aria-label={texts.wayLabel(groupLabel)}
          >
            <SelectValue placeholder={ptBR.schemaForm.nothingChosenPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="carNumber">{texts.wayOptions.carNumber}</SelectItem>
            <SelectItem value="place">{texts.wayOptions.place}</SelectItem>
            <SelectItem value="typed">{texts.wayOptions.typed}</SelectItem>
          </SelectContent>
        </Select>
      )}

      {pickShown !== undefined && (
        <CarPickControls
          pick={pickShown}
          groupLabel={groupLabel}
          controlId={controlId}
          bindingOptions={bindingOptions}
          isDisabled={isDisabled}
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

      {groupMessage !== undefined && <p className="text-sm text-destructive">{groupMessage}</p>}
    </fieldset>
  );
}

/** The line that says why a group's fields are separate, when they do not follow one car. */
function SeparateFieldsNote(props: { carGroup: CarGroup; formValues: SchemaFormValues }) {
  const agreement = readAgreementOfCarGroupFields(props.carGroup, props.formValues);
  if (agreement.status === 'differentCars') {
    return (
      <p className="text-sm text-muted-foreground">
        {texts.differentCarsNote(props.carGroup.label)}
      </p>
    );
  }
  if (agreement.status === 'notOnePick') {
    return (
      <p className="text-sm text-muted-foreground">{texts.notOnePickNote(props.carGroup.label)}</p>
    );
  }
  return null;
}

/** The places a car can be picked at, 1st to 10th. */
const placeNumbersOffered = Array.from(
  { length: highestPlaceACarCanBePickedAt },
  (_unused, index) => index + 1,
);

/**
 * The controls of one pick: the source, the car's number or its place, and "Ao vivo /
 * Congelado na entrada", each change handed back as the whole pick after it.
 */
function CarPickControls(props: {
  pick: CarPickInForm;
  groupLabel: string;
  controlId: string;
  bindingOptions: SchemaFormBindingOptions;
  isDisabled: boolean;
  onPickChanged: (pickAfter: CarPickInForm) => void;
}) {
  const { pick, groupLabel, controlId, bindingOptions, isDisabled, onPickChanged } = props;
  const editorTexts = ptBR.bindings.editor;

  return (
    <div className="flex flex-col gap-2">
      {bindingOptions.dataSources.length === 0 ? (
        <p className="text-sm text-muted-foreground">{editorTexts.noSourceYet}</p>
      ) : (
        <Select
          value={pick.sourceId}
          onValueChange={(sourceId) => onPickChanged({ ...pick, sourceId })}
          disabled={isDisabled}
        >
          <SelectTrigger size="sm" className="w-full" aria-label={texts.sourceLabel(groupLabel)}>
            <SelectValue placeholder={ptBR.schemaForm.nothingChosenPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {bindingOptions.dataSources.map((dataSource) => (
              <SelectItem key={dataSource.id} value={dataSource.id}>
                {dataSource.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {pick.pickedBy === 'number' && (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${controlId}-car-number`}>{texts.carNumberLabel(groupLabel)}</Label>
          <Input
            id={`${controlId}-car-number`}
            inputMode="numeric"
            autoComplete="off"
            disabled={isDisabled}
            value={pick.carNumberText}
            onChange={(event) => onPickChanged({ ...pick, carNumberText: event.target.value })}
          />
        </div>
      )}

      {pick.pickedBy === 'place' && (
        <Select
          value={pick.placeNumber === undefined ? '' : String(pick.placeNumber)}
          onValueChange={(placeText) => onPickChanged({ ...pick, placeNumber: Number(placeText) })}
          disabled={isDisabled}
        >
          <SelectTrigger size="sm" className="w-full" aria-label={texts.placeLabel(groupLabel)}>
            <SelectValue placeholder={ptBR.schemaForm.nothingChosenPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {placeNumbersOffered.map((placeNumber) => (
              <SelectItem key={placeNumber} value={String(placeNumber)}>
                {texts.placeOption(placeNumber)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        value={pick.isLive ? 'live' : 'frozen'}
        onValueChange={(choice) => onPickChanged({ ...pick, isLive: choice === 'live' })}
        disabled={isDisabled}
      >
        <SelectTrigger size="sm" className="w-full" aria-label={texts.whenLabel(groupLabel)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="live">{editorTexts.whenOptions.live}</SelectItem>
          <SelectItem value="frozen">{editorTexts.whenOptions.frozen}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

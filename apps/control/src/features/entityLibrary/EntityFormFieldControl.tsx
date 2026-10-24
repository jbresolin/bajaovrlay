import {
  BrazilianStateCodeSchema,
  ptBREntities,
  SessionKindSchema,
  SponsorTierSchema,
} from '@bajaovrlay/shared';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buildErrorAttributesForControl } from '@/features/items/FormFieldRow';
import { ptBR } from '@/i18n/ptBR';

import { EntityImageField } from './EntityImageField';
import type { EntityFormField } from './entityRecordForm';

/**
 * The value of the first item of an optional dropdown (a team's UF), which empties the
 * field: Radix Select allows no item whose value is "", so the item carries this one and
 * the change is read back as "".
 */
const noChoiceValue = 'sem-escolha';

/** One choice of a dropdown: the value stored and the label shown. */
type DropdownChoice = { value: string; label: string };

/** The choices of each dropdown kind of field: the 27 UFs, the five tiers, the kinds. */
function listChoicesOfField(field: EntityFormField): DropdownChoice[] {
  switch (field.fieldKind) {
    case 'state':
      return BrazilianStateCodeSchema.options.map((stateCode) => ({
        value: stateCode,
        label: stateCode,
      }));
    case 'tier':
      return SponsorTierSchema.options.map((tier) => ({
        value: tier,
        label: ptBREntities.tierLabels[tier],
      }));
    case 'sessionKind':
      return SessionKindSchema.options.map((sessionKind) => ({
        value: sessionKind,
        label: ptBR.bindings.overrides.sessionKinds[sessionKind] ?? sessionKind,
      }));
    default:
      return [];
  }
}

/** What the form gives one control. */
export type EntityFormFieldControlProps = {
  field: EntityFormField;
  controlId: string;
  value: string;
  onChange: (value: string) => void;
  errorMessage: string | undefined;
  /** True for a field that cannot be changed here (a team's car number, when editing). */
  isLocked: boolean;
};

/**
 * The control one field of a Cadastros form is typed in, by its kind: a text input (with
 * a number keyboard for a whole number), a date and time input on this computer's clock,
 * a dropdown for a state, a tier or a kind of session, or an image field that uploads at
 * once. Every control holds text; entityRecordForm.ts reads it into the record.
 */
export function EntityFormFieldControl(props: EntityFormFieldControlProps) {
  const { field, controlId, value, onChange, errorMessage } = props;
  const errorAttributes = buildErrorAttributesForControl(controlId, errorMessage);
  switch (field.fieldKind) {
    case 'text':
    case 'wholeNumber':
      return (
        <Input
          id={controlId}
          value={value}
          inputMode={field.fieldKind === 'wholeNumber' ? 'numeric' : 'text'}
          disabled={props.isLocked}
          onChange={(event) => onChange(event.target.value)}
          {...errorAttributes}
        />
      );
    case 'localDateTime':
      return (
        <Input
          id={controlId}
          type="datetime-local"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          {...errorAttributes}
        />
      );
    case 'state':
    case 'tier':
    case 'sessionKind':
      return (
        <Select
          value={value}
          onValueChange={(chosen) => onChange(chosen === noChoiceValue ? '' : chosen)}
        >
          <SelectTrigger
            id={controlId}
            className="w-full"
            aria-label={field.label}
            {...errorAttributes}
          >
            <SelectValue placeholder={ptBR.entityLibrary.form.noChoice} />
          </SelectTrigger>
          <SelectContent>
            {field.isOptional && (
              <SelectItem value={noChoiceValue}>{ptBR.entityLibrary.form.leaveEmpty}</SelectItem>
            )}
            {listChoicesOfField(field).map((choice) => (
              <SelectItem key={choice.value} value={choice.value}>
                {choice.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'image':
      return (
        <EntityImageField
          controlId={controlId}
          label={field.label}
          mediaId={value}
          onMediaIdChange={onChange}
        />
      );
  }
}

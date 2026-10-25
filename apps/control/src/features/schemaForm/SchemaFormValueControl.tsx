import type { RefCallBack } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ptBR } from '@/i18n/ptBR';

import type { SchemaFormFieldDescription } from './schemaFormDescription';
import type { SchemaFormFieldValue } from './schemaFormValues';

/** What every control of a generated form is handed, whichever control it is. */
export type SchemaFormValueControlProps = {
  field: SchemaFormFieldDescription;
  /** The element id the field's label points at. */
  controlId: string;
  formValue: SchemaFormFieldValue;
  onFormValueChange: (formValue: SchemaFormFieldValue) => void;
  onBlur: () => void;
  /** react-hook-form's handle on the control, so it can put the cursor on a wrong field. */
  focusRef: RefCallBack;
  /** Ids of the help text and the error message under the control, for screen readers. */
  describedByIds: string | undefined;
  hasError: boolean;
  isDisabled: boolean;
};

/**
 * Draws the control that edits one field's value: a text input, a dropdown, a date and
 * time input, a number input, an mm:ss text field or a switch, as the field's
 * description says. It holds nothing itself: the value comes in and every change goes
 * out, so react-hook-form stays the only place the form's values live.
 * An unsupported field and a list of texts draw nothing here; UnsupportedValueBox.tsx and
 * TextListField.tsx show those.
 * What could go wrong: a browser's number input hands over an empty text while what is
 * typed is not a number ("1e", "--"), so in a real browser such a field reads as blank
 * (refused when required, cleared when optional) instead of "not a number".
 */
export function SchemaFormValueControl(props: SchemaFormValueControlProps) {
  const { field, controlId, formValue, onFormValueChange, onBlur, focusRef, isDisabled } = props;
  const attributesForScreenReaders = {
    'aria-invalid': props.hasError,
    'aria-describedby': props.describedByIds,
    'aria-required': field.isRequired,
  };
  const textInTheInput = typeof formValue === 'string' ? formValue : '';

  switch (field.control) {
    case 'text':
      return (
        <Input
          id={controlId}
          ref={focusRef}
          autoComplete="off"
          value={textInTheInput}
          minLength={field.minimumLength}
          maxLength={field.maximumLength}
          disabled={isDisabled}
          onChange={(event) => onFormValueChange(event.target.value)}
          onBlur={onBlur}
          {...attributesForScreenReaders}
        />
      );
    case 'select':
      return (
        // The empty text is how the dropdown is told "nothing chosen": it then shows its
        // placeholder. No option can have the empty text as its value (see the reader).
        <Select value={textInTheInput} onValueChange={onFormValueChange} disabled={isDisabled}>
          <SelectTrigger
            id={controlId}
            ref={focusRef}
            className="w-full"
            onBlur={onBlur}
            {...attributesForScreenReaders}
          >
            <SelectValue placeholder={ptBR.schemaForm.nothingChosenPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {field.selectOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'dateTime':
      return (
        <Input
          id={controlId}
          ref={focusRef}
          type="datetime-local"
          value={textInTheInput}
          disabled={isDisabled}
          onChange={(event) => onFormValueChange(event.target.value)}
          onBlur={onBlur}
          {...attributesForScreenReaders}
        />
      );
    case 'number':
      return (
        <Input
          id={controlId}
          ref={focusRef}
          type="number"
          autoComplete="off"
          inputMode={field.isWholeNumber ? 'numeric' : 'decimal'}
          step={field.isWholeNumber ? 1 : 'any'}
          min={field.minimum}
          max={field.maximum}
          value={textInTheInput}
          disabled={isDisabled}
          onChange={(event) => onFormValueChange(event.target.value)}
          onBlur={onBlur}
          {...attributesForScreenReaders}
        />
      );
    case 'duration':
      return (
        <Input
          id={controlId}
          ref={focusRef}
          autoComplete="off"
          inputMode="numeric"
          placeholder={ptBR.schemaForm.durationPlaceholder}
          value={textInTheInput}
          disabled={isDisabled}
          onChange={(event) => onFormValueChange(event.target.value)}
          onBlur={onBlur}
          {...attributesForScreenReaders}
        />
      );
    case 'switch':
      return (
        <Switch
          id={controlId}
          ref={focusRef}
          checked={formValue === true}
          disabled={isDisabled}
          onCheckedChange={onFormValueChange}
          onBlur={onBlur}
          {...attributesForScreenReaders}
        />
      );
    // A list of texts draws its own lines (TextListField.tsx); the read-only JSON box
    // draws an unsupported field (UnsupportedValueBox.tsx).
    case 'textList':
    case 'unsupported':
      return null;
  }
}

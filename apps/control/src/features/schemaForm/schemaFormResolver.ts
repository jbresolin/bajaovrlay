import type { FieldError, FieldErrors, ResolverResult } from 'react-hook-form';

import { checkSchemaFormValues } from './checkSchemaFormValues';
import type { SchemaFormDescription } from './schemaFormDescription';
import type { SchemaFormValues } from './schemaFormValues';

/**
 * Builds the bridge between a generated form's rules and react-hook-form, for the
 * `resolver` option of `useForm<SchemaFormValues>()`. Whenever the form is checked the
 * bridge answers either "valid, here are the values" (the same values, untouched: the
 * `...FromSchemaForm.ts` builders turn them into data) or one pt-BR message per wrong
 * field, under `values.<key>`, which is where SchemaFormFields looks for it.
 * All the rules are in checkSchemaFormValues.ts; this only reshapes their result. It is
 * hand-written, like the page's other resolvers, instead of adding @hookform/resolvers.
 * What could go wrong: the rules belong to one description. A panel that lets the
 * operator pick another graphic must build a new resolver for it (calling this on every
 * draw is fine: react-hook-form reads the option each time it checks).
 */
export function buildSchemaFormResolver(
  description: SchemaFormDescription,
): (formValues: SchemaFormValues) => ResolverResult<SchemaFormValues> {
  return function resolveSchemaForm(formValues) {
    const check = checkSchemaFormValues(description, formValues);
    if (check.status === 'valid') {
      return { values: formValues, errors: {} };
    }

    // Field keys were checked when the description was built (a key react-hook-form
    // cannot hold is never an editable field), so plain assignment is safe here.
    const errorByFieldKey: Record<string, FieldError> = {};
    for (const fieldMessage of check.fieldMessages) {
      errorByFieldKey[fieldMessage.fieldKey] = {
        type: 'validation',
        message: fieldMessage.message,
      };
    }
    const errors: FieldErrors<SchemaFormValues> = { values: errorByFieldKey };
    return { values: {}, errors };
  };
}

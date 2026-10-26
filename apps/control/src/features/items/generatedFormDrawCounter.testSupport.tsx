// Test support: counts how many times the item editor's generated form is drawn
// (BAJAOVRLAY-45, gate 2 round 1 of PR #29). SchemaFormFields is not memoised, so it is
// drawn every time the form around it (ItemGraphicFieldsForm) is: its draws are the form's.
// Counting the rows alone is not enough, since memoised rows hide a form that redraws at
// every poll. A test file puts the counting stand-in in place with:
//   vi.mock('@/features/schemaForm', async (importOriginal) => {
//     const schemaForm = await importOriginal<typeof import('@/features/schemaForm')>();
//     const { buildSchemaFormFieldsThatCountTheirDraws } = await import(
//       './generatedFormDrawCounter.testSupport'
//     );
//     return {
//       ...schemaForm,
//       SchemaFormFields: buildSchemaFormFieldsThatCountTheirDraws(schemaForm.SchemaFormFields),
//     };
//   });
//
// What could go wrong: the count lives in this module and is shared by the tests of a
// file, so each test calls startCountingGeneratedFormDraws() in its Arrange step.
import type { ComponentProps, ComponentType } from 'react';

import type { SchemaFormFields } from '@/features/schemaForm';

type SchemaFormFieldsProps = ComponentProps<typeof SchemaFormFields>;

let generatedFormDrawsSoFar = 0;

/** Forgets every draw counted so far: what is read from now on happened after this call. */
export function startCountingGeneratedFormDraws(): void {
  generatedFormDrawsSoFar = 0;
}

/** How many times the generated form was drawn since startCountingGeneratedFormDraws. */
export function countGeneratedFormDraws(): number {
  return generatedFormDrawsSoFar;
}

/** SchemaFormFields as it is, counting each of its draws before drawing it. */
export function buildSchemaFormFieldsThatCountTheirDraws(
  RealSchemaFormFields: ComponentType<SchemaFormFieldsProps>,
) {
  return function SchemaFormFieldsThatCountTheirDraws(props: SchemaFormFieldsProps) {
    generatedFormDrawsSoFar += 1;
    return <RealSchemaFormFields {...props} />;
  };
}

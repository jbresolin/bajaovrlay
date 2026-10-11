// Test support: draws a generated form the way a panel does (a react-hook-form form with
// the generated resolver around SchemaFormFields) and hands the test the few things an
// operator and a panel do with it. Nothing here is shared between tests: every call
// builds its own form.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';

import type { SchemaFormDescription } from './schemaFormDescription';
import { SchemaFormFields } from './SchemaFormFields';
import { buildSchemaFormResolver } from './schemaFormResolver';
import type { SchemaFormDirtyFields, SchemaFormValues } from './schemaFormValues';

/** The start of every element id of the form on the test page. */
export const controlIdPrefixOnTestPage = 'formulario-de-teste';

/** What a test gets back after drawing a generated form. */
export type SchemaFormOnTestPage = {
  /** What the form holds right now. */
  readFormValues: () => SchemaFormValues;
  /** Which fields react-hook-form counts as changed since the form was filled. */
  readDirtyFields: () => SchemaFormDirtyFields;
  /** Checks the whole form, as a press on "Colocar no ar" does; answers "is it valid?". */
  checkTheForm: () => Promise<boolean>;
};

/** Draws SchemaFormFields for this description, filled with these values. */
export function renderSchemaFormOnTestPage(options: {
  description: SchemaFormDescription;
  formValues: SchemaFormValues;
  isDisabled?: boolean;
}): SchemaFormOnTestPage {
  // The form lives inside the page; this holder is how the test reaches it afterwards.
  const holder: {
    form: UseFormReturn<SchemaFormValues> | undefined;
    dirtyFields: SchemaFormDirtyFields;
  } = { form: undefined, dirtyFields: {} };

  function TestPage() {
    const form = useForm<SchemaFormValues>({
      defaultValues: options.formValues,
      resolver: buildSchemaFormResolver(options.description),
    });
    // react-hook-form only keeps track of the parts of its state a page reads while it
    // draws, so the changed fields are read here, on every draw.
    const dirtyFields = form.formState.dirtyFields;
    useEffect(() => {
      holder.form = form;
      holder.dirtyFields = dirtyFields;
    });

    return (
      <SchemaFormFields
        form={form}
        description={options.description}
        controlIdPrefix={controlIdPrefixOnTestPage}
        isDisabled={options.isDisabled}
      />
    );
  }
  render(<TestPage />);

  function readFormOfThePage(): UseFormReturn<SchemaFormValues> {
    if (holder.form === undefined) {
      throw new Error('The test page has not drawn its form yet');
    }
    return holder.form;
  }

  return {
    readFormValues: () => readFormOfThePage().getValues(),
    readDirtyFields: () => holder.dirtyFields,
    checkTheForm: async () => {
      let isValid = false;
      // `act` tells React "something outside the page just changed; redraw before the
      // test goes on", so the messages are on the page when this returns.
      await act(async () => {
        isValid = await readFormOfThePage().trigger();
      });
      return isValid;
    },
  };
}

/** Types into a text field found by its label, replacing what was there. */
export function typeIntoField(fieldLabel: string, text: string): void {
  fireEvent.change(screen.getByLabelText(fieldLabel), { target: { value: text } });
}

/** Opens a dropdown found by its accessible name and picks one of its options. */
export function chooseOptionInDropdown(dropdownName: string, optionLabel: string): void {
  fireEvent.keyDown(screen.getByRole('combobox', { name: dropdownName }), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: optionLabel }));
}

/** Presses a button found by its accessible name. */
export function pressButton(buttonName: string): void {
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
}

/** Flips a switch found by its label. */
export function flipSwitch(switchLabel: string): void {
  fireEvent.click(screen.getByRole('switch', { name: switchLabel }));
}

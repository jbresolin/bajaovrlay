/**
 * A binding with two transforms in the form (apps/control)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-47 a binding may carry a second transform, applied to what the first
 *   gave: the podium's cars read the positions through topN (3), then withTeamLogos. The
 *   item editor holds it as two more plain choices (the second transform's id and its one
 *   parameter as text); reading the form back builds the binding the item stores, and a
 *   stored binding fills the form back.
 *
 * What these tests prove:
 *   - The podium's binding read from the form stores topN with n = 3 and withTeamLogos
 *     after it, with no parameters key for withTeamLogos, which takes none.
 *   - A stored binding with two transforms fills the form back, the second's parameter
 *     included when it has one, and reading that form gives the same binding.
 *   - A second transform left in the form without a first is dropped, never stored alone.
 *
 * What these tests deliberately do not cover:
 *   - Which second transforms are offered; bindingChoices.test.ts.
 *   - Drawing the second transform's dropdown; SchemaFormFieldsListFieldBinding.test.tsx.
 */
import type { BindingFieldValue } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildSchemaFormBindingValueFromBinding,
  emptySchemaFormBindingValue,
  readBindingFromSchemaFormValue,
} from './bindingFormValue';
import {
  buildPositionsTowerFixtureDataSchema,
  describePositionsTowerFixtureForm,
} from './positionsTowerFixtureSchema.testSupport';

/** The list of cars of the tower-like fixture, as the form describes the field. */
function describeTheCarsField() {
  const carsField = describePositionsTowerFixtureForm().fields.find(
    (field) => field.key === 'entries',
  );
  if (carsField === undefined) {
    throw new Error('the fixture has a list of cars; this is a bug in the test');
  }
  return carsField;
}

/** The podium's recipe as the operator chooses it: the first 3 cars, then their logos. */
function buildPodiumChoicesInTheForm() {
  return {
    ...emptySchemaFormBindingValue,
    sourceId: 'simulador-enduro',
    pathKey: 'positions:entries',
    isLive: false,
    transformId: 'topN',
    transformParameterText: '3',
    thenTransformId: 'withTeamLogos',
  };
}

describe('a binding with a second transform in the form', () => {
  it('stores the podium’s topN of 3 followed by withTeamLogos', () => {
    // Arrange: the podium's choices in the form.
    const bindingValue = buildPodiumChoicesInTheForm();

    // Act: read the binding the form makes.
    const bindingRead = readBindingFromSchemaFormValue(
      describeTheCarsField(),
      bindingValue,
      buildPositionsTowerFixtureDataSchema(),
      false,
    );

    // Assert: the binding the item stores, withTeamLogos without a parameters key.
    expect(bindingRead, 'the form must store both transforms, in order').toEqual({
      status: 'binding',
      binding: {
        kind: 'binding',
        sourceId: 'simulador-enduro',
        shapeKey: 'positions',
        path: 'entries',
        isLive: false,
        transformId: 'topN',
        transformParameters: { n: 3 },
        thenTransformId: 'withTeamLogos',
      },
    });
  });

  it('fills the form back from a stored binding with two transforms, and reads it the same', () => {
    // Arrange: a stored binding whose second transform takes a parameter (logos first,
    // then the first 3 of the standings).
    const storedBinding: BindingFieldValue = {
      kind: 'binding',
      sourceId: 'simulador-enduro',
      shapeKey: 'standings',
      path: 'entries',
      isLive: true,
      transformId: 'withTeamLogos',
      thenTransformId: 'topN',
      thenTransformParameters: { n: 3 },
    };

    // Act: fill the form from it, then read the form back.
    const bindingValue = buildSchemaFormBindingValueFromBinding(storedBinding);
    const bindingRead = readBindingFromSchemaFormValue(
      describeTheCarsField(),
      bindingValue,
      buildPositionsTowerFixtureDataSchema(),
      false,
    );

    // Assert: the second transform and its parameter in the form, and the same binding.
    expect(bindingValue.thenTransformId, 'the second transform fills the form').toBe('topN');
    expect(bindingValue.thenTransformParameterText, 'its parameter is typed back').toBe('3');
    expect(bindingRead, 'reading the form back gives the stored binding').toEqual({
      status: 'binding',
      binding: storedBinding,
    });
  });

  it('drops a second transform left in the form without a first', () => {
    // Arrange: the podium's choices with the first transform cleared.
    const bindingValue = { ...buildPodiumChoicesInTheForm(), transformId: '' };

    // Act: read the binding the form makes.
    const bindingRead = readBindingFromSchemaFormValue(
      describeTheCarsField(),
      bindingValue,
      buildPositionsTowerFixtureDataSchema(),
      false,
    );

    // Assert: no transform at all is stored.
    const binding = bindingRead.status === 'binding' ? bindingRead.binding : undefined;
    expect(binding?.transformId, 'no first transform').toBeUndefined();
    expect(binding?.thenTransformId, 'a second transform is never stored alone').toBeUndefined();
  });
});

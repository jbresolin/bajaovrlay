/**
 * A field read from the entity library, through the generated form's life (apps/control)
 *
 * What this module is for:
 *   The item editor fills its form from a stored item, checks it, and builds the fields
 *   createItem or updateItemFields sends. A field stored as an entity reference
 *   ("Cadastro", BAJAOVRLAY-19) travels the same road as a binding: it opens as
 *   "Cadastro" with its choices, is stored as the reference, counts as changed only when
 *   the choice changed, and is never sent by "Atualizar no ar" (the next take reads it).
 *
 * What these tests prove:
 *   - An item whose title reads car 7's team name opens with the title as "Cadastro" and
 *     its choices.
 *   - A new item stores the reference; an unchanged one is not sent again, a changed one is.
 *   - The field is listed among those "Atualizar no ar" leaves out, and switching it to
 *     "Cadastro" counts as a source choice that waits for the next take.
 *   - An item whose title reads the library and whose laps read the event it shows
 *     (BAJAOVRLAY-44) opens with both kinds and their choices, and saves back unchanged.
 *
 * What these tests deliberately do not cover:
 *   - Reading the choices; entityReferenceFormValue.test.ts.
 */
import type { EntityFieldValue, ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildEmptySchemaFormValues,
  buildSchemaFormValuesFromItemFields,
} from './buildSchemaFormValues';
import {
  hasSourceChoiceChangedSinceOpened,
  listFieldKeysReadFromASource,
} from './fieldsReadFromASource';
import {
  buildChangedItemFieldsFromSchemaForm,
  buildItemFieldsFromSchemaForm,
} from './itemFieldsFromSchemaForm';
import { describeTeamCardFixture } from './teamCardFixtureSchema.testSupport';

/** The title reading the name of car `carNumber`'s team. */
function buildTitleFromTheTeamOfCar(carNumber: number): EntityFieldValue {
  return { kind: 'entity', entityType: 'team', carNumber, attribute: 'teamName' };
}

/** A stored team card whose title reads car 7's team and whose laps are typed. */
function buildStoredCardFieldsOfCar7(): ItemFields {
  return {
    titulo: buildTitleFromTheTeamOfCar(7),
    voltas: { kind: 'literal', value: 34 },
  };
}

describe('a field read from the entity library in the generated form', () => {
  it('opens as "Cadastro" with its choices', () => {
    // Arrange: the stored card.
    const storedFields = buildStoredCardFieldsOfCar7();

    // Act: fill the form from it.
    const { formValues, labelsOfFieldsThatCouldNotBeRead } = buildSchemaFormValuesFromItemFields(
      describeTeamCardFixture(),
      storedFields,
    );

    // Assert: the title is "Cadastro" with car 7's team name; nothing unreadable.
    expect(formValues.kinds.titulo, 'the kind').toBe('entity');
    expect(formValues.entityReferences?.titulo, 'the choices').toEqual({
      entityType: 'team',
      recordKey: '7',
      attribute: 'teamName',
    });
    expect(labelsOfFieldsThatCouldNotBeRead, 'every field was read').toEqual([]);
  });

  it('stores the reference for a new item', () => {
    // Arrange: an empty form with the title switched to "Cadastro", car 7's team name.
    const formValues = buildEmptySchemaFormValues(describeTeamCardFixture());
    formValues.kinds.titulo = 'entity';
    formValues.entityReferences = {
      titulo: { entityType: 'team', recordKey: '7', attribute: 'teamName' },
    };

    // Act: build the new item's fields.
    const itemFields = buildItemFieldsFromSchemaForm(describeTeamCardFixture(), formValues);

    // Assert: the title is the reference.
    expect(itemFields.titulo, 'the stored reference').toEqual(buildTitleFromTheTeamOfCar(7));
  });

  it('sends the reference again only when the choice changed', () => {
    // Arrange: the stored card opened in the form, and a copy pointed at car 42.
    const description = describeTeamCardFixture();
    const storedFields = buildStoredCardFieldsOfCar7();
    const unchangedForm = buildSchemaFormValuesFromItemFields(description, storedFields).formValues;
    const changedForm = buildSchemaFormValuesFromItemFields(description, storedFields).formValues;
    changedForm.entityReferences = {
      titulo: { entityType: 'team', recordKey: '42', attribute: 'teamName' },
    };

    // Act: build the changed fields of each.
    const changedOfTheUnchanged = buildChangedItemFieldsFromSchemaForm(
      description,
      unchangedForm,
      storedFields,
    );
    const changedOfTheChanged = buildChangedItemFieldsFromSchemaForm(
      description,
      changedForm,
      storedFields,
    );

    // Assert: nothing for the first, the new reference for the second.
    expect(changedOfTheUnchanged, 'an unchanged reference is not sent').toEqual({});
    expect(changedOfTheChanged, 'a changed one is').toEqual({
      titulo: buildTitleFromTheTeamOfCar(42),
    });
  });

  it('is left out of "Atualizar no ar", and switching to it waits for the next take', () => {
    // Arrange: the empty form as opened, and the same form with the title set to "Cadastro".
    const description = describeTeamCardFixture();
    const formAsOpened = buildEmptySchemaFormValues(description);
    const formNow = buildEmptySchemaFormValues(description);
    formNow.kinds.titulo = 'entity';
    formNow.entityReferences = {
      titulo: { entityType: 'team', recordKey: '7', attribute: 'teamName' },
    };

    // Act: list the fields read from a source, and ask whether a source choice changed.
    const keysReadFromASource = listFieldKeysReadFromASource(description, formNow);
    const hasChoiceChanged = hasSourceChoiceChangedSinceOpened(description, formNow, formAsOpened);

    // Assert: the title is among them, and the change waits for the take.
    expect(keysReadFromASource, 'the title is not sent on air').toEqual(['titulo']);
    expect(hasChoiceChanged, 'the note "na próxima entrada" shows').toBe(true);
  });
});

describe('an item reading both the entity library and the event it shows', () => {
  it('opens with "Cadastro" and "Evento" side by side and saves both back unchanged', () => {
    // Arrange: a notice card whose title reads car 7's team from the library and whose
    // laps read the lap of the event it shows (BAJAOVRLAY-44).
    const description = describeTeamCardFixture();
    const storedFields: ItemFields = {
      titulo: buildTitleFromTheTeamOfCar(7),
      voltas: { kind: 'eventField', path: 'lapNumber' },
    };

    // Act: open it in the form, then build the item's fields and the changed ones from it.
    const { formValues } = buildSchemaFormValuesFromItemFields(description, storedFields);
    const itemFields = buildItemFieldsFromSchemaForm(description, formValues);
    const changedFields = buildChangedItemFieldsFromSchemaForm(
      description,
      formValues,
      storedFields,
    );

    // Assert: each field keeps its kind and its choice; saved, the item is what it was,
    // and nothing counts as changed.
    // The card's logo, which the item leaves empty, stays typed.
    expect(formValues.kinds, 'the title from the library, the laps from the event').toEqual({
      titulo: 'entity',
      voltas: 'eventField',
      logo: 'literal',
    });
    expect(formValues.entityReferences?.titulo, "the title's choices").toEqual({
      entityType: 'team',
      recordKey: '7',
      attribute: 'teamName',
    });
    expect(formValues.eventPaths?.voltas, "the laps' payload field").toBe('lapNumber');
    expect(itemFields, 'both fields are saved as they were stored').toEqual(storedFields);
    expect(changedFields, 'nothing changed, so nothing is sent').toEqual({});
  });
});

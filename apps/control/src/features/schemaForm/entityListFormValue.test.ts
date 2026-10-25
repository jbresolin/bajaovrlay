/**
 * "Lista dos cadastros" as the item editor holds it (apps/control)
 *
 * What this module is for:
 *   A list field of a graphic (the sponsor roll's sponsors, the sessions board's slots)
 *   may read a whole list of the entity library (BAJAOVRLAY-46): every sponsor, or every
 *   slot of the schedule. The editor offers it only where some list fits the field (the
 *   shared rule, an array of objects whose `items.required` the list's items carry), holds
 *   the chosen kind of list under `entityLists.<key>`, says how long the list is now
 *   ("Valor agora: 17 patrocinadores"), and stores `{ kind: 'entityList', entityType }`.
 *
 * What these tests prove:
 *   - The offer rule: the sponsors field is offered the sponsors only, the slots field
 *     the schedule only, a text field nothing.
 *   - The "Valor agora" words: 17 patrocinadores (the sponsor without a logo not
 *     counted), 1 patrocinador, 6 sessões, 1 sessão, and the reason when the list is empty.
 *   - A stored entity list opens as "Lista dos cadastros" with its kind, and the checked
 *     form stores it back unchanged.
 *
 * What these tests deliberately do not cover:
 *   - Drawing the controls; SchemaFormFieldsEntityList.test.tsx.
 *   - The server's take of the list; the server's resolveItemFieldsWithEntityLists.test.ts.
 */
import type { EntityLibrary, ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildLibraryOfThe30thCompetition,
  describeBoardWithEntityListsForm,
} from './boardWithEntityListsFixtureSchema.testSupport';
import { buildSchemaFormValuesFromItemFields } from './buildSchemaFormValuesFromItemFields';
import {
  listEntityListTypesOfferedToField,
  writeEntityListValueNowText,
} from './entityListFormValue';
import { buildItemFieldsFromSchemaForm } from './itemFieldsFromSchemaForm';

describe('listEntityListTypesOfferedToField', () => {
  const fieldScenarios = [
    // The roll's list asks for keys every sponsor carries.
    {
      name: 'offers the sponsors to the sponsors field',
      fieldKey: 'sponsors',
      expected: ['sponsor'],
    },
    // The board's list asks for keys every slot carries.
    {
      name: 'offers the schedule to the slots field',
      fieldKey: 'slots',
      expected: ['scheduleSlot'],
    },
    // A text is not a list.
    { name: 'offers nothing to the title', fieldKey: 'title', expected: [] },
  ];

  it.each(fieldScenarios)('$name', ({ fieldKey, expected }) => {
    // Arrange: the board's form.
    const description = describeBoardWithEntityListsForm();

    // Act: list what is offered to the field.
    const offered = listEntityListTypesOfferedToField(description.dataSchema, fieldKey);

    // Assert: exactly the expected lists.
    expect(offered, `the lists offered to "${fieldKey}"`).toEqual(expected);
  });
});

describe('writeEntityListValueNowText', () => {
  /** The 30ª Competição's library with only the sponsors and slots kept by the filters. */
  function buildLibraryKeeping(
    keepSponsor: (name: string) => boolean,
    keepSlot: (slotId: string) => boolean,
  ): EntityLibrary {
    const library = buildLibraryOfThe30thCompetition();
    return {
      ...library,
      sponsors: library.sponsors.filter((sponsor) => keepSponsor(sponsor.name)),
      scheduleSlots: library.scheduleSlots.filter((slot) => keepSlot(slot.slotId)),
    };
  }

  const valueNowScenarios = [
    // The real 17; Pneus Trilha, with no logo, is not on the list and not counted.
    {
      name: 'counts the 17 sponsors with a logo',
      listType: 'sponsor' as const,
      library: buildLibraryKeeping(
        () => true,
        () => true,
      ),
      expected: 'Valor agora: 17 patrocinadores',
    },
    // One sponsor is written in the singular.
    {
      name: 'writes one sponsor in the singular',
      listType: 'sponsor' as const,
      library: buildLibraryKeeping(
        (name) => name === 'Bosch',
        () => true,
      ),
      expected: 'Valor agora: 1 patrocinador',
    },
    // Sunday's six slots.
    {
      name: 'counts the six slots of the schedule',
      listType: 'scheduleSlot' as const,
      library: buildLibraryKeeping(
        () => true,
        () => true,
      ),
      expected: 'Valor agora: 6 sessões',
    },
    // One slot in the singular.
    {
      name: 'writes one slot in the singular',
      listType: 'scheduleSlot' as const,
      library: buildLibraryKeeping(
        () => true,
        (slotId) => slotId === 'enduro',
      ),
      expected: 'Valor agora: 1 sessão',
    },
    // Only Pneus Trilha, no logo: the list is empty, and the line says why.
    {
      name: 'says why the sponsor list is empty',
      listType: 'sponsor' as const,
      library: buildLibraryKeeping(
        (name) => name === 'Pneus Trilha',
        () => true,
      ),
      expected: 'Sem valor agora: nenhum patrocinador com logo nos cadastros.',
    },
  ];

  it.each(valueNowScenarios)('$name', ({ listType, library, expected }) => {
    // Arrange: the library of this row.

    // Act: write the "Valor agora" line.
    const text = writeEntityListValueNowText(listType, library);

    // Assert: the words the editor shows.
    expect(text, 'the line under the list').toBe(expected);
  });
});

describe('an entity list stored on an item', () => {
  it('opens as "Lista dos cadastros" with its kind, and is stored back unchanged', () => {
    // Arrange: a board item that reads every sponsor and every slot.
    const description = describeBoardWithEntityListsForm();
    const storedFields: ItemFields = {
      title: { kind: 'literal', value: 'Intervalo' },
      sponsors: { kind: 'entityList', entityType: 'sponsor' },
      slots: { kind: 'entityList', entityType: 'scheduleSlot' },
    };

    // Act: open the item in the form, then build its fields back from the form.
    const { formValues } = buildSchemaFormValuesFromItemFields(description, storedFields);
    const fieldsBack = buildItemFieldsFromSchemaForm(description, formValues);

    // Assert: both lists held as such, and stored back as they were.
    expect(formValues.kinds.sponsors, 'the sponsors open as a list of Cadastros').toBe(
      'entityList',
    );
    expect(formValues.entityLists, 'each list keeps its kind').toEqual({
      sponsors: 'sponsor',
      slots: 'scheduleSlot',
    });
    expect(fieldsBack, 'the item stores the lists back unchanged').toEqual(storedFields);
  });
});

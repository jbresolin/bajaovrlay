/**
 * The address of one record of Cadastros (apps/control)
 *
 * What this module is for:
 *   "Editar no cadastro", beside a field of "Edição rápida" that reads the entity library
 *   (gate 2 of PR #23), opens Cadastros on that record in a new browser tab. The record is
 *   written in the address after "#", as the pages are ("#/cadastros/team/42"), so the
 *   new tab needs nothing but its address.
 *
 * What these tests prove:
 *   - Team 42, the narrator and a slot get the address of their record, an id written so
 *     no character of it breaks the address.
 *   - Each such address is read back as its record.
 *   - Cadastros alone, an unknown kind and a car "number" that is not one open no record.
 *
 * What these tests deliberately do not cover:
 *   - Cadastros opening the form; EntityLibraryPageOpensARecord.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import { buildHashOfRecordToOpen, readRecordToOpenFromHash } from './recordToOpen';

const records = [
  // Team 42, by its car number.
  {
    name: 'team 42',
    recordToOpen: { entityType: 'team', recordKey: '42' } as const,
    expectedHash: '#/cadastros/team/42',
  },
  // The narrator, by the id the page gave the person.
  {
    name: 'the narrator',
    recordToOpen: { entityType: 'person', recordKey: 'narrador-joao' } as const,
    expectedHash: '#/cadastros/person/narrador-joao',
  },
  // A slot id typed in a CSV may carry a space or a slash; the address keeps it whole.
  {
    name: 'a slot whose id has a space and a slash',
    recordToOpen: { entityType: 'scheduleSlot', recordKey: 'sábado 10/11' } as const,
    expectedHash: '#/cadastros/scheduleSlot/s%C3%A1bado%2010%2F11',
  },
];

describe('buildHashOfRecordToOpen and readRecordToOpenFromHash', () => {
  it.each(records)(
    'writes and reads back the address of $name',
    ({ recordToOpen, expectedHash }) => {
      // Arrange: the record of this row.

      // Act: write its address, then read it back.
      const hash = buildHashOfRecordToOpen(recordToOpen);
      const recordReadBack = readRecordToOpenFromHash(hash);

      // Assert: the address, and the same record from it.
      expect(hash, 'the address of the record').toBe(expectedHash);
      expect(recordReadBack, 'the address names the same record').toEqual(recordToOpen);
    },
  );
});

describe('readRecordToOpenFromHash', () => {
  const addressesOfNoRecord = [
    // The header's "Cadastros" link: the page, no record.
    { name: 'Cadastros alone', hash: '#/cadastros' },
    // A kind of record the library does not have.
    { name: 'an unknown kind', hash: '#/cadastros/carro/42' },
    // A team is kept by a whole car number.
    { name: 'a team "number" that is not one', hash: '#/cadastros/team/quarenta' },
    // Another page altogether.
    { name: 'the console', hash: '#/' },
  ];

  it.each(addressesOfNoRecord)('opens no record for $name', ({ hash }) => {
    // Arrange: the address of this row.

    // Act: read it.
    const recordToOpen = readRecordToOpenFromHash(hash);

    // Assert: no record.
    expect(recordToOpen, 'no record to open').toBeUndefined();
  });
});

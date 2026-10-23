import type { EntityType } from '@bajaovrlay/shared';

/**
 * The CSV columns of each Cadastros tab: the file format a spreadsheet writes and the
 * page reads and exports. Column names are pt-BR words with no accents or spaces, so a
 * spreadsheet saving in another encoding cannot change them. Images are not columns:
 * a CSV never carries one (the brief), and an update from a CSV keeps the record's own.
 * The same table drives the import, the export, the example file and the column list
 * the page shows, so the four never disagree.
 */

/** How a cell is read into the record: as text, as a whole number, as a date and time. */
export type CsvCellKind = 'text' | 'wholeNumber' | 'localDateTime';

/** One column: its name in the header, the record field it fills, how, and whether required. */
export type EntityCsvColumn = {
  columnName: string;
  recordFieldKey: string;
  cellKind: CsvCellKind;
  isRequired: boolean;
};

const csvColumnsByEntityType: Record<EntityType, EntityCsvColumn[]> = {
  team: [
    { columnName: 'carro', recordFieldKey: 'carNumber', cellKind: 'wholeNumber', isRequired: true },
    { columnName: 'equipe', recordFieldKey: 'teamName', cellKind: 'text', isRequired: true },
    { columnName: 'escola', recordFieldKey: 'schoolName', cellKind: 'text', isRequired: true },
    {
      columnName: 'escola_completa',
      recordFieldKey: 'schoolFullName',
      cellKind: 'text',
      isRequired: false,
    },
    { columnName: 'cidade', recordFieldKey: 'city', cellKind: 'text', isRequired: false },
    { columnName: 'uf', recordFieldKey: 'state', cellKind: 'text', isRequired: false },
  ],
  person: [
    { columnName: 'id', recordFieldKey: 'personId', cellKind: 'text', isRequired: false },
    { columnName: 'nome', recordFieldKey: 'name', cellKind: 'text', isRequired: true },
    { columnName: 'funcao', recordFieldKey: 'role', cellKind: 'text', isRequired: true },
    {
      columnName: 'carro',
      recordFieldKey: 'carNumber',
      cellKind: 'wholeNumber',
      isRequired: false,
    },
  ],
  sponsor: [
    { columnName: 'id', recordFieldKey: 'sponsorId', cellKind: 'text', isRequired: false },
    { columnName: 'nome', recordFieldKey: 'name', cellKind: 'text', isRequired: true },
    { columnName: 'cota', recordFieldKey: 'tier', cellKind: 'text', isRequired: true },
    { columnName: 'peso', recordFieldKey: 'rollWeight', cellKind: 'wholeNumber', isRequired: true },
  ],
  scheduleSlot: [
    { columnName: 'id', recordFieldKey: 'slotId', cellKind: 'text', isRequired: false },
    { columnName: 'sessao', recordFieldKey: 'sessionName', cellKind: 'text', isRequired: true },
    { columnName: 'prova', recordFieldKey: 'sessionKind', cellKind: 'text', isRequired: true },
    {
      columnName: 'inicio',
      recordFieldKey: 'startsAtMs',
      cellKind: 'localDateTime',
      isRequired: true,
    },
    { columnName: 'fim', recordFieldKey: 'endsAtMs', cellKind: 'localDateTime', isRequired: false },
    { columnName: 'local', recordFieldKey: 'place', cellKind: 'text', isRequired: false },
  ],
};

/** The columns of one tab, in the order the export writes them. */
export function listCsvColumnsOfEntityType(entityType: EntityType): EntityCsvColumn[] {
  return csvColumnsByEntityType[entityType];
}

/**
 * The record field that is the key of a kind of record: a team's car number, the id of
 * the others. A CSV line with a key the library holds updates that record.
 */
export function readKeyFieldOfEntityType(entityType: EntityType): string {
  switch (entityType) {
    case 'team':
      return 'carNumber';
    case 'person':
      return 'personId';
    case 'sponsor':
      return 'sponsorId';
    case 'scheduleSlot':
      return 'slotId';
  }
}

/** The record fields of each kind that hold an image, kept from the library on an update. */
export function listImageFieldsOfEntityType(entityType: EntityType): string[] {
  switch (entityType) {
    case 'team':
      return ['logoMediaId', 'carPhotoMediaId'];
    case 'person':
      return ['photoMediaId'];
    case 'sponsor':
      return ['logoMediaId'];
    case 'scheduleSlot':
      return [];
  }
}

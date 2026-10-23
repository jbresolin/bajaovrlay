import type { EntityType } from '@bajaovrlay/shared';

import { hashOfEachPage } from './currentPage';

/**
 * One record of Cadastros to open: its kind and its key as text (a team's car number, or
 * the id of a person, sponsor or slot), as features/entityLibrary's readKeyOfRecord
 * writes it.
 */
export type RecordToOpen = { entityType: EntityType; recordKey: string };

const entityTypesInAddresses: readonly EntityType[] = ['team', 'person', 'sponsor', 'scheduleSlot'];
const wholeCarNumberPattern = /^[1-9][0-9]*$/;

/**
 * "#/cadastros/team/42": the address "Editar no cadastro" opens (gate 2 of PR #23). The
 * key is percent-encoded, since an id typed in a CSV may hold a space or a slash.
 */
export function buildHashOfRecordToOpen(recordToOpen: RecordToOpen): string {
  const encodedKey = encodeURIComponent(recordToOpen.recordKey);
  return `${hashOfEachPage.entityLibrary}/${recordToOpen.entityType}/${encodedKey}`;
}

/**
 * The record an address of Cadastros names, or undefined: for Cadastros alone, another
 * page, an unknown kind, a team key that is not a whole car number, or a key that does
 * not decode.
 */
export function readRecordToOpenFromHash(hash: string): RecordToOpen | undefined {
  const prefix = `${hashOfEachPage.entityLibrary}/`;
  if (!hash.startsWith(prefix)) {
    return undefined;
  }
  const rest = hash.slice(prefix.length);
  const slashIndex = rest.indexOf('/');
  if (slashIndex === -1) {
    return undefined;
  }
  const entityTypeText = rest.slice(0, slashIndex);
  const entityType = entityTypesInAddresses.find((candidate) => candidate === entityTypeText);
  if (entityType === undefined) {
    return undefined;
  }
  let recordKey: string;
  try {
    recordKey = decodeURIComponent(rest.slice(slashIndex + 1));
  } catch {
    // A "%" not followed by two hexadecimal digits: hand-typed, it names no record.
    return undefined;
  }
  const isTeamKeyAWholeNumber = wholeCarNumberPattern.test(recordKey);
  if (recordKey === '' || (entityType === 'team' && !isTeamKeyAWholeNumber)) {
    return undefined;
  }
  return { entityType, recordKey };
}

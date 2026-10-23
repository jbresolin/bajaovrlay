import { isDeepStrictEqual } from 'node:util';

/**
 * The list with each new record in place of the stored one of the same key, and the new
 * keys added at the end in the order given. The very same list comes back when nothing
 * differs (every record already stored exactly so), so nothing is saved or broadcast.
 * Shared by upsertEntity (one record) and importEntities (many), for the four slices.
 */
export function upsertRecordsByKey<RecordType, KeyValue>(
  storedRecords: RecordType[],
  newRecords: RecordType[],
  readKey: (record: RecordType) => KeyValue,
): RecordType[] {
  const recordsAfter = [...storedRecords];
  let hasAnyRecordChanged = false;
  for (const newRecord of newRecords) {
    const keyOfTheNewRecord = readKey(newRecord);
    const placeOfTheStoredRecord = recordsAfter.findIndex(
      (storedRecord) => readKey(storedRecord) === keyOfTheNewRecord,
    );
    if (placeOfTheStoredRecord === -1) {
      recordsAfter.push(newRecord);
      hasAnyRecordChanged = true;
      continue;
    }
    if (!isDeepStrictEqual(recordsAfter[placeOfTheStoredRecord], newRecord)) {
      recordsAfter[placeOfTheStoredRecord] = newRecord;
      hasAnyRecordChanged = true;
    }
  }
  return hasAnyRecordChanged ? recordsAfter : storedRecords;
}

/**
 * The list without the record of that key, or the very same list when no record has it
 * (deleting what is not there changes nothing).
 */
export function removeRecordByKey<RecordType, KeyValue>(
  storedRecords: RecordType[],
  keyToRemove: KeyValue,
  readKey: (record: RecordType) => KeyValue,
): RecordType[] {
  const recordsKept = storedRecords.filter((record) => readKey(record) !== keyToRemove);
  return recordsKept.length === storedRecords.length ? storedRecords : recordsKept;
}

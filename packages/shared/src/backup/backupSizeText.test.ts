/**
 * The size of a backup as the operator reads it (packages/shared)
 *
 * What this module is for:
 *   "Cópia de segurança" shows the size a backup will have before it is made, and "Última
 *   cópia: 14:32, 48 MB" after; the history says the same in its sentence. The operator
 *   compares that number with the free space Windows shows for the USB stick, so it is
 *   counted the way Windows Explorer counts (1 MB = 1024 × 1024 bytes) and written in
 *   pt-BR, with a decimal comma.
 *
 * What these tests prove:
 *   - Each size range is written as the table below says, from a few bytes to gigabytes.
 *
 * What these tests deliberately do not cover:
 *   - Where the sizes come from: the server's backup module (backupContents.test.ts).
 */
import { describe, expect, it } from 'vitest';

import { formatBackupSize } from './backupSizeText.js';

const oneMegabyte = 1024 * 1024;
const oneGigabyte = 1024 * oneMegabyte;

const sizeScenarios = [
  // A new server's database with nothing in it yet still reads as a size, not "0 MB".
  { name: 'under a tenth of a megabyte', sizeInBytes: 40_960, expectedText: '0,1 MB' },
  // Below 10 MB one decimal still helps tell two small copies apart.
  { name: 'a few megabytes', sizeInBytes: 3.46 * oneMegabyte, expectedText: '3,5 MB' },
  // From 10 MB on, whole megabytes, as "Última cópia: 14:32, 48 MB" in the brief.
  { name: 'tens of megabytes', sizeInBytes: 48.3 * oneMegabyte, expectedText: '48 MB' },
  // From 1 GB on (a day of recordings), gigabytes with one decimal.
  { name: 'over a gigabyte', sizeInBytes: 2.25 * oneGigabyte, expectedText: '2,3 GB' },
];

describe('formatBackupSize', () => {
  it.each(sizeScenarios)('writes $name as "$expectedText"', ({ sizeInBytes, expectedText }) => {
    // Arrange: the size of the backup, in bytes (from the table row).

    // Act: write it for the operator.
    const sizeText = formatBackupSize(sizeInBytes);

    // Assert: the text the operator reads.
    expect(sizeText, `${String(sizeInBytes)} bytes must read as ${expectedText}`).toBe(
      expectedText,
    );
  });
});

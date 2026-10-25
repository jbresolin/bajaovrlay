/**
 * The cota column of a sponsors CSV, in the design's levels (apps/control)
 *
 * What this module is for:
 *   BAJAOVRLAY-46 renames the top sponsor level from "master" to "diamante" and adds
 *   "realizacao", the organiser. A spreadsheet the organisers kept from before still says
 *   "master" in its cota column, so the import reads "master" as "diamante"; the export
 *   always writes the design's level, so a file the page writes says "diamante".
 *
 * What these tests prove:
 *   - "master" in the cota column imports as diamante; "diamante" and "realizacao" import
 *     as they are.
 *   - A level that is neither is an error with the shared pt-BR sentence listing the six.
 *   - The export writes "diamante", never "master".
 *
 * What these tests deliberately do not cover:
 *   - The other columns; entityCsvImport.test.ts and entityCsvImportLightPlate.test.ts.
 *   - A stored row saying "master" at boot; the server's sponsorLevelAtBoot.test.ts.
 */
import type { EntityLibrary } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { writeRecordsAsCsv } from './entityCsvExport';
import { buildCsvImportPreview } from './entityCsvImport';

/** A library with no sponsor yet, as the stored side of the imports below. */
function buildLibraryWithoutSponsors(): EntityLibrary {
  return { teams: [], people: [], sponsors: [], scheduleSlots: [] };
}

/** Makes ids as the page does, but predictable: "novo-1", "novo-2"… */
function createPredictableIdMaker() {
  let nextNumber = 1;
  return () => {
    const id = `novo-${String(nextNumber)}`;
    nextNumber += 1;
    return id;
  };
}

describe('buildCsvImportPreview of the cota column', () => {
  it('reads "master" as diamante and the new levels as they are', () => {
    // Arrange: the organisers' old file says master for Bosch; the new rows say diamante
    // and realizacao.
    const csv =
      'id;nome;cota;peso\n' +
      'bosch;Bosch;master;10\n' +
      'rgdb;Renault Geely do Brasil;diamante;10\n' +
      'sae-brasil;SAE Brasil;realizacao;5\n';

    // Act: build the preview.
    const preview = buildCsvImportPreview(
      'sponsor',
      csv,
      buildLibraryWithoutSponsors(),
      createPredictableIdMaker(),
    );

    // Assert: three new sponsors, Bosch at diamante.
    expect(
      preview.rows.map((row) => (row.record as { tier?: string } | undefined)?.tier),
      'the level each line imports with',
    ).toEqual(['diamante', 'diamante', 'realizacao']);
    expect(
      preview.rows.map((row) => row.status),
      'every line is a new sponsor',
    ).toEqual(['new', 'new', 'new']);
  });

  it('refuses a level that is neither the old name nor a new one, listing the six', () => {
    // Arrange: a level nobody ever sold.
    const csv = 'id;nome;cota;peso\n' + 'bosch;Bosch;platina;10\n';

    // Act: build the preview.
    const preview = buildCsvImportPreview(
      'sponsor',
      csv,
      buildLibraryWithoutSponsors(),
      createPredictableIdMaker(),
    );

    // Assert: an error with the shared sentence.
    expect(preview.rows[0]?.reason, 'an unknown level is refused in pt-BR').toBe(
      'Cota: use diamante, ouro, prata, bronze, apoio ou realizacao.',
    );
  });
});

describe('writeRecordsAsCsv of the sponsors', () => {
  it('writes the design’s level, diamante, for the top sponsor', () => {
    // Arrange: Bosch at the top level, as the library holds it after the boot's migration.
    const library: EntityLibrary = {
      ...buildLibraryWithoutSponsors(),
      sponsors: [{ sponsorId: 'bosch', name: 'Bosch', tier: 'diamante', rollWeight: 10 }],
    };

    // Act: export the sponsors.
    const csv = writeRecordsAsCsv('sponsor', library);

    // Assert: the file says diamante (after the byte-order mark every export starts with,
    // so a spreadsheet opens the accents right).
    expect(csv, 'the export must write the design’s level').toBe(
      '\uFEFFid;nome;cota;peso;placa_clara\r\n' + 'bosch;Bosch;diamante;10;\r\n',
    );
  });
});

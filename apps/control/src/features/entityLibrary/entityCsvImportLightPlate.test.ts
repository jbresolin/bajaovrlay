/**
 * Reading the placa_clara column of a CSV (apps/control)
 *
 * What this module is for:
 *   A team's and a sponsor's logo may go on a small light plate on air (BAJAOVRLAY-24 for
 *   teams, BAJAOVRLAY-23 for sponsors). The choice can come in a CSV as the placa_clara
 *   column, which a spreadsheet writes as "sim", "não" (or "nao", typed without the
 *   accent) or leaves empty.
 *
 * What these tests prove:
 *   - In a teams file, "sim" and "SIM" read as yes, "não" and "nao" as no, an empty cell
 *     leaves the choice out, and "talvez" is an error naming the field in pt-BR.
 *   - In a sponsors file, the same column reads the same way, and an older sponsors file
 *     without the column keeps the plate a sponsor already has.
 *
 * What these tests deliberately do not cover:
 *   - The other columns and the preview's statuses; entityCsvImport.test.ts.
 *   - Writing the column; entityCsvExport.test.ts.
 */
import type { EntityLibrary } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildCsvImportPreview } from './entityCsvImport';

/** A library with team 42 and the narrator, as the stored side of every import below. */
function buildLibraryWithTeam42AndTheNarrator(): EntityLibrary {
  return {
    teams: [{ carNumber: 42, teamName: 'Baja UFPR', schoolName: 'UFPR' }],
    people: [{ personId: 'narrador-joao', name: 'João Bresolin', role: 'Narrador' }],
    sponsors: [],
    scheduleSlots: [],
  };
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

describe('buildCsvImportPreview of the light plate column', () => {
  it('reads sim and SIM as yes, não and nao as no, an empty cell as no choice, and refuses talvez', () => {
    // Arrange: six teams, one per way of writing the cell ("SIM" as a spreadsheet with caps
    // lock, or an upper-case export, writes it).
    const csv =
      'carro;equipe;escola;placa_clara\n' +
      '42;Baja UFPR;UFPR;sim\n' +
      '55;Carcará Baja;UFRN;SIM\n' +
      '7;Juriti Off-Road;UDESC;não\n' +
      '13;Mutum Off-Road;UFMT;nao\n' +
      '21;Gralha Azul Baja;UTFPR;\n' +
      '30;Caledônia Racing;UERJ;talvez\n';

    // Act: build the preview.
    const preview = buildCsvImportPreview(
      'team',
      csv,
      buildLibraryWithTeam42AndTheNarrator(),
      createPredictableIdMaker(),
    );

    // Assert: yes, yes, no, no, left out, and an error in pt-BR naming the field.
    expect(
      preview.rows.map(
        (row) => (row.record as { logoOnLightPlate?: boolean } | undefined)?.logoOnLightPlate,
      ),
      'what each line says about the plate',
    ).toEqual([true, true, false, false, undefined, undefined]);
    expect(preview.rows[5]?.reason, 'a word other than sim or não is refused').toBe(
      'Logo sobre placa clara: sim ou não.',
    );
  });
});

describe('buildCsvImportPreview of the sponsors’ light plate column', () => {
  it('reads sim as yes and an empty cell as no choice for a sponsor too', () => {
    // Arrange: two sponsors, the master's logo on the plate, the support's with no choice.
    const csv =
      'id;nome;cota;peso;placa_clara\n' +
      'master;Mineradora Serra Azul;master;10;sim\n' +
      'apoio-pneus;Pneus Trilha;apoio;2;\n';

    // Act: build the preview.
    const preview = buildCsvImportPreview(
      'sponsor',
      csv,
      buildLibraryWithTeam42AndTheNarrator(),
      createPredictableIdMaker(),
    );

    // Assert: yes for the master sponsor, left out for the support sponsor.
    expect(
      preview.rows.map(
        (row) => (row.record as { logoOnLightPlate?: boolean } | undefined)?.logoOnLightPlate,
      ),
      'what each line says about the plate',
    ).toEqual([true, undefined]);
  });
});

describe('buildCsvImportPreview of an older sponsors file, without the column', () => {
  it('keeps the plate the stored master sponsor already has', () => {
    // Arrange: the master sponsor stored with its logo on the plate, and a sponsors file
    // from before BAJAOVRLAY-23, with only its four columns, that lowers the weight.
    const library: EntityLibrary = {
      ...buildLibraryWithTeam42AndTheNarrator(),
      sponsors: [
        {
          sponsorId: 'master',
          name: 'Mineradora Serra Azul',
          tier: 'master',
          rollWeight: 10,
          logoOnLightPlate: true,
        },
      ],
    };
    const csv = 'id;nome;cota;peso\n' + 'master;Mineradora Serra Azul;master;8\n';

    // Act: build the preview.
    const preview = buildCsvImportPreview('sponsor', csv, library, createPredictableIdMaker());

    // Assert: an update with the new weight, and the plate still on.
    expect(preview.rows[0]?.status, 'the stored sponsor is updated').toBe('update');
    expect(preview.rows[0]?.record, 'the new weight, and the stored plate kept').toEqual({
      sponsorId: 'master',
      name: 'Mineradora Serra Azul',
      tier: 'master',
      rollWeight: 8,
      logoOnLightPlate: true,
    });
  });
});

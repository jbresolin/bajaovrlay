/**
 * The standings' data and its defaults (packages/graphics/standings)
 *
 * What this module is for:
 *   standingsModel.ts is the boundary check for what `load` and `updateAction` receive:
 *   the entries of the canonical standings shape (rank optional for a disqualified team,
 *   fractional and negative points, parts by id), the score parts, a typed title and event
 *   line. It applies the defaults, merges partial updates and describes bad data in pt-BR.
 *
 * What these tests prove:
 *   - The real 54-team export with its parts passes, a disqualified team without a rank
 *     included, and an entry carrying a field the graphic does not draw passes too.
 *   - The title defaults to "CLASSIFICAÇÃO GERAL", the event line to nothing, the parts to
 *     none (the columns board).
 *   - Bad data is refused with one pt-BR sentence naming the field.
 *   - A partial update replaces only what it carries, and a refused one changes nothing.
 *
 * What these tests deliberately do not cover:
 *   - The shape's own rules (a disqualified team after every ranked one, a part key that
 *     names no part); packages/shared's standings schema tests them and the graphic draws
 *     what it is given.
 *   - The manifest's JSON Schema; standingsManifestDataAgreement.test.ts checks both agree.
 */
import { describe, expect, it } from 'vitest';

import { createOverallStandingsWithParts } from './previewData.js';
import {
  mergePartialUpdateIntoStandingsData,
  parseCompleteStandingsData,
  readStandingsSettings,
} from './standingsModel.js';

describe('parseCompleteStandingsData', () => {
  it('accepts the real overall standings with their parts and four disqualified teams', () => {
    // Arrange: the 54 teams of the export, six parts, a title and an event line.
    const data = createOverallStandingsWithParts();

    // Act: check it as load does.
    const check = parseCompleteStandingsData(data);

    // Assert: valid, every team kept.
    expect(check.isValid, 'the real export must pass the model').toBe(true);
    expect(check.isValid && check.data.entries, 'all 54 teams must be kept').toHaveLength(54);
  });

  it('accepts an entry carrying a field the graphic does not draw', () => {
    // Arrange: Baja UFMG with the shape's scope note the graphic ignores.
    const data = {
      entries: [
        {
          rank: 1,
          carNumber: 2,
          teamName: 'Baja UFMG',
          schoolName: 'UFMG',
          points: 921.8,
          logoUrl: '/media/logo-baja-ufmg',
        },
      ],
    };

    // Act: check it.
    const check = parseCompleteStandingsData(data);

    // Assert: valid; a field the shape gains later must not break the binding.
    expect(check.isValid, 'an extra entry field must not be refused').toBe(true);
  });

  it('refuses an entry without its points, naming the field in pt-BR', () => {
    // Arrange: Equipe FEI Baja with its total missing.
    const data = {
      entries: [{ rank: 2, carNumber: 1, teamName: 'Equipe FEI Baja', schoolName: 'FEI' }],
    };

    // Act: check it.
    const check = parseCompleteStandingsData(data);

    // Assert: refused with the field named.
    expect(check, 'a team without points cannot be drawn').toEqual({
      isValid: false,
      problem: 'Falta o campo obrigatório "entries[0].points".',
    });
  });

  it('refuses a top-level field the graphic does not know, usually a typo', () => {
    // Arrange: the title typed as "titulo".
    const data = { entries: [], titulo: 'CLASSIFICAÇÃO GERAL' };

    // Act: check it.
    const check = parseCompleteStandingsData(data);

    // Assert: refused, naming the unknown field.
    expect(check, 'an unknown top-level field must be refused').toEqual({
      isValid: false,
      problem: 'Campo desconhecido nos dados: "titulo".',
    });
  });
});

describe('readStandingsSettings', () => {
  it('applies the defaults: the title "CLASSIFICAÇÃO GERAL", no event line, no parts', () => {
    // Arrange: data with the entries alone.
    const data = { entries: [] };

    // Act: read the settings.
    const settings = readStandingsSettings(data);

    // Assert: the manifest's default title, and nothing else.
    expect(settings, 'the defaults must be applied to what was left out').toEqual({
      title: 'CLASSIFICAÇÃO GERAL',
      eventLine: '',
      scoreParts: [],
    });
  });

  it('keeps a typed title and event line', () => {
    // Arrange: the enduro's table, titled by the operator.
    const data = {
      entries: [],
      title: 'CLASSIFICAÇÃO · ENDURO',
      eventLine: '30ª COMPETIÇÃO BAJA SAE BRASIL',
    };

    // Act: read the settings.
    const settings = readStandingsSettings(data);

    // Assert: both as typed.
    expect(settings.title, 'a typed title must be kept').toBe('CLASSIFICAÇÃO · ENDURO');
    expect(settings.eventLine, 'a typed event line must be kept').toBe(
      '30ª COMPETIÇÃO BAJA SAE BRASIL',
    );
  });
});

describe('mergePartialUpdateIntoStandingsData', () => {
  it('replaces the entries of a live update and keeps the parts and the title', () => {
    // Arrange: the overall standings on air, and an update with the top two alone.
    const currentData = createOverallStandingsWithParts();
    const update = { entries: currentData.entries.slice(0, 2) };

    // Act: merge it.
    const check = mergePartialUpdateIntoStandingsData(currentData, update);

    // Assert: two teams now, the six parts and the title unchanged.
    expect(check.isValid && check.data.entries, 'the new list must replace the old').toHaveLength(
      2,
    );
    expect(check.isValid && check.data.scoreParts, 'the parts must be kept').toHaveLength(6);
    expect(check.isValid && check.data.title, 'the title must be kept').toBe('CLASSIFICAÇÃO GERAL');
  });

  it('refuses a bad update and leaves the current data untouched', () => {
    // Arrange: the standings on air, and an update with points written as text.
    const currentData = createOverallStandingsWithParts();
    const badUpdate = {
      entries: [
        { rank: 1, carNumber: 2, teamName: 'Baja UFMG', schoolName: 'UFMG', points: '921,8' },
      ],
    };

    // Act: merge it.
    const check = mergePartialUpdateIntoStandingsData(currentData, badUpdate);

    // Assert: refused in pt-BR, and the data on air still has its 54 teams.
    expect(check, 'points as text must be refused').toEqual({
      isValid: false,
      problem: 'Valor inválido no campo "entries[0].points".',
    });
    expect(currentData.entries, 'a refused update must change nothing').toHaveLength(54);
  });
});

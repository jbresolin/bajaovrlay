/**
 * A sponsor's level, as the design names it (packages/shared)
 *
 * What this module is for:
 *   The organisers sell sponsorship by level, and every sponsor round on air (the sponsor
 *   roll, its corner card, the intermission's sponsor line) goes through the levels in one
 *   order: Diamante, Ouro, Prata, Bronze, Apoio, then Realização (SAE Brasil, the
 *   organiser) last (BAJAOVRLAY-46). A sponsor's `tier` holds one of these six levels.
 *   The order is written once, in sponsorLevels.ts, which carries no Zod so the graphics
 *   can bundle it; the record's schema is built from it.
 *
 * What these tests prove:
 *   - The six levels, in the round order, and the schema takes exactly those.
 *   - "master", the top level's name before the design renamed it, is refused by the
 *     schema with a pt-BR sentence listing the six; reading an old row is the boot's
 *     migration, and the CSV takes it as an alias.
 *   - Each level has its pt-BR name for Cadastros.
 *
 * What these tests deliberately do not cover:
 *   - The migration of a stored row at boot; the server's sponsorLevelAtBoot.test.ts.
 *   - The CSV alias; the control page's entityCsvImport.test.ts.
 *   - The on-air headings ("PATROCÍNIO DIAMANTE") and holds; the graphics kit's
 *     sponsorRound.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { ptBREntities } from './ptBREntities.js';
import { SponsorSchema, SponsorTierSchema } from './sponsor.js';
import { sponsorLevelsInRoundOrder } from './sponsorLevels.js';

/** Bosch, the 30ª Competição's Diamante sponsor, with no logo yet. */
function buildBoschAsDiamante() {
  return { sponsorId: 'bosch', name: 'Bosch', tier: 'diamante', rollWeight: 10 };
}

describe('the sponsor levels', () => {
  it('lists the six levels in the order every sponsor round goes through them', () => {
    // Arrange: nothing; the order is a fixed list.

    // Act: read it.
    const levels = sponsorLevelsInRoundOrder;

    // Assert: Diamante first, Realização (the organiser) last.
    expect(levels, 'the round order must be the design’s, the organiser last').toEqual([
      'diamante',
      'ouro',
      'prata',
      'bronze',
      'apoio',
      'realizacao',
    ]);
  });

  it('builds the record’s schema from the same list, in the same order', () => {
    // Arrange: nothing; the schema is built from the list.

    // Act: read the schema's options.
    const schemaLevels = SponsorTierSchema.options;

    // Assert: the very list, so a level cannot be added to one and not the other.
    expect(schemaLevels, 'the schema must take exactly the six levels').toEqual(
      sponsorLevelsInRoundOrder,
    );
  });

  it('accepts a Diamante sponsor and the organiser as Realização', () => {
    // Arrange: Bosch at the top level, and SAE Brasil as the organiser.
    const bosch = buildBoschAsDiamante();
    const saeBrasil = { sponsorId: 'sae', name: 'SAE Brasil', tier: 'realizacao', rollWeight: 5 };

    // Act: check both.
    const boschResult = SponsorSchema.safeParse(bosch);
    const saeResult = SponsorSchema.safeParse(saeBrasil);

    // Assert: both accepted as they are.
    expect(boschResult.data, 'a Diamante sponsor must be accepted').toEqual(bosch);
    expect(saeResult.data, 'the organiser must be accepted as Realização').toEqual(saeBrasil);
  });

  it('refuses "master", the old name of the top level, listing the six in pt-BR', () => {
    // Arrange: a sponsor written with the name the top level had before the design.
    const sponsorWithTheOldName = { ...buildBoschAsDiamante(), tier: 'master' };

    // Act: check it.
    const result = SponsorSchema.safeParse(sponsorWithTheOldName);

    // Assert: refused; only the boot's migration and the CSV read the old name.
    expect(result.error?.issues[0]?.message, 'the reason must list the six levels').toBe(
      'Cota: use diamante, ouro, prata, bronze, apoio ou realizacao.',
    );
  });

  const levelNames = [
    // The top level, renamed from "Master" by the design.
    { name: 'names Diamante', level: 'diamante' as const, expected: 'Diamante' },
    // The four the organisers sold before.
    { name: 'names Ouro', level: 'ouro' as const, expected: 'Ouro' },
    { name: 'names Prata', level: 'prata' as const, expected: 'Prata' },
    { name: 'names Bronze', level: 'bronze' as const, expected: 'Bronze' },
    { name: 'names Apoio', level: 'apoio' as const, expected: 'Apoio' },
    // The organiser, with its accent, though the stored value has none.
    {
      name: 'names Realização with its accent',
      level: 'realizacao' as const,
      expected: 'Realização',
    },
  ];

  it.each(levelNames)('$name', ({ level, expected }) => {
    // Arrange: the level of this row.

    // Act: read the name Cadastros shows for it.
    const label = ptBREntities.tierLabels[level];

    // Assert: the pt-BR name.
    expect(label, 'Cadastros must show the level’s pt-BR name').toBe(expected);
  });
});

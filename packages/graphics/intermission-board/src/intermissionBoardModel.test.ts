/**
 * The intermission board's data and parts (packages/graphics/intermission-board)
 *
 * What this module is for:
 *   intermissionBoardModel.ts checks the data the board receives and lists its parts: the
 *   first five teams (a whole list bound without `topN` still shows five), and the sponsor
 *   line's pages, on the sponsor roll's rule (the kit's planSponsorPages, four a page).
 *
 * What these tests prove:
 *   - The real 17 sponsors make seven line pages: Diamante 2, Ouro 3 + 3 + 3, Apoio 3 + 2,
 *     Realização 1; no sponsor gives no page.
 *   - Six teams give the first five; a disqualified team's rank is "—" and never the chip.
 *   - A partial update replaces the top five and keeps the rest; one taking a part off
 *     (sent as undefined) leaves it out; a bad one changes nothing.
 *
 * What these tests deliberately do not cover:
 *   - Which payloads pass; intermissionBoardManifestDataAgreement.test.ts.
 */
import { createThe30thCompetitionSponsors } from '@bajaovrlay/graphics-kit/the30thCompetitionSponsors.testSupport';
import { describe, expect, it } from 'vitest';

import {
  type IntermissionBoardData,
  isTeamOnTheLeaderChip,
  listIntermissionBoardParts,
  mergePartialUpdateIntoIntermissionBoardData,
  writeRankOfTeam,
} from './intermissionBoardModel.js';
import { createBreakBeforeTheEnduro } from './intermissionBoardOnThePage.testSupport.js';

describe('listIntermissionBoardParts', () => {
  it('pages the real 17 on lines of four: Diamante 2, Ouro 3 + 3 + 3, Apoio 3 + 2, Realização 1', () => {
    // Arrange: the break with the 17.
    const data: IntermissionBoardData = {
      ...createBreakBeforeTheEnduro({ hasTopFive: false, hasSponsors: false }),
      sponsors: createThe30thCompetitionSponsors(),
    };

    // Act: list its parts.
    const parts = listIntermissionBoardParts(data);

    // Assert: seven pages, a level each, shared evenly.
    expect(
      parts.sponsorLinePages.map((page) => `${page.level} ${String(page.sponsors.length)}`),
      'the line’s pages',
    ).toEqual(['diamante 2', 'ouro 3', 'ouro 3', 'ouro 3', 'apoio 3', 'apoio 2', 'realizacao 1']);
  });

  it('gives no line page and no team without the optional parts', () => {
    // Arrange: the break with neither part.
    const data = createBreakBeforeTheEnduro({ hasTopFive: false, hasSponsors: false });

    // Act: list its parts.
    const parts = listIntermissionBoardParts(data);

    // Assert: nothing to draw.
    expect([parts.topFive, parts.sponsorLinePages], 'neither part').toEqual([[], []]);
  });

  it('keeps the first five of a list of six', () => {
    // Arrange: the top five and a sixth team, as a binding without topN would send.
    const data = createBreakBeforeTheEnduro({ hasTopFive: true, hasSponsors: false });
    data.topFive?.push({
      rank: 6,
      carNumber: 77,
      teamName: 'Baja Mauá',
      schoolName: 'MAUÁ',
      points: 790.1,
    });

    // Act: list its parts.
    const parts = listIntermissionBoardParts(data);

    // Assert: five, Baja Mauá left out.
    expect(
      parts.topFive.map((entry) => entry.carNumber),
      'the first five',
    ).toEqual([2, 1, 10, 47, 5]);
  });
});

describe('a team’s rank', () => {
  it('writes "—" for a disqualified team and never puts it on the chip', () => {
    // Arrange: a disqualified team that kept its rank 1 in the export.
    const entry = {
      rank: 1,
      carNumber: 42,
      teamName: 'Garra Baja',
      schoolName: 'USJT',
      points: 0,
      isDisqualified: true,
    };

    // Act: write its rank and ask for the chip.
    const rankText = writeRankOfTeam(entry);
    const isOnTheChip = isTeamOnTheLeaderChip(entry);

    // Assert: the dash, no chip.
    expect([rankText, isOnTheChip], 'a disqualified team').toEqual(['—', false]);
  });
});

describe('mergePartialUpdateIntoIntermissionBoardData', () => {
  it('takes a part off when it is sent as undefined, and keeps the rest', () => {
    // Arrange: the full break on air.
    const onAir = createBreakBeforeTheEnduro({ hasTopFive: true, hasSponsors: true });

    // Act: the refresh takes the sponsors off (the renderer sends a removed field as undefined).
    const check = mergePartialUpdateIntoIntermissionBoardData(onAir, { sponsors: undefined });

    // Assert: no sponsors, the top five kept.
    const data = check.isValid ? check.data : undefined;
    expect(data?.sponsors, 'the line leaves').toBeUndefined();
    expect(data?.topFive?.length, 'the top five stays').toBe(5);
  });

  it('refuses a bad update in pt-BR and changes nothing', () => {
    // Arrange: the full break on air.
    const onAir = createBreakBeforeTheEnduro({ hasTopFive: true, hasSponsors: true });

    // Act: an update with an empty session.
    const check = mergePartialUpdateIntoIntermissionBoardData(onAir, { nextSessionName: '' });

    // Assert: refused, nothing half-applied.
    expect(check, 'refused').toEqual({
      isValid: false,
      problem: 'Valor inválido no campo "nextSessionName".',
    });
    expect(onAir, 'as it was').toEqual(
      createBreakBeforeTheEnduro({ hasTopFive: true, hasSponsors: true }),
    );
  });
});

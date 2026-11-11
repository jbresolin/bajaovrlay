/**
 * The plain sponsor roll's one pass (packages/shared)
 *
 * What this module is for:
 *   The plain sponsor roll (BAJAOVRLAY-64) shows every sponsor once, one at a time, then
 *   leaves by itself: the server takes it off air when the pass ends, so a trigger can bring
 *   it back every N minutes. The graphic and the server must agree to the millisecond on how
 *   long that pass is, so both read this one module: each level's hold, the entrance, and
 *   the plan of the pass worked out from the sponsor list.
 *
 * What these tests prove:
 *   - Each level's hold, Diamante the longest, Bronze on the general hold.
 *   - The pass: the entrance, then each sponsor's hold in turn; its length is their sum.
 *   - The order is the round's (Diamante … Realização last), whatever the list's order,
 *     and sponsors of one level keep the order they came in.
 *   - A sponsor with no logo (or an empty one) is skipped: it adds no time and no card.
 *   - A list with no sponsor to show is a pass of the entrance alone.
 *
 * What these tests deliberately do not cover:
 *   - That Ardósia's hold tokens equal this table; the graphics kit's
 *     sponsorHoldsOfTheTheme.test.ts.
 *   - The graphic turning its sponsors at these moments; the sponsor-roll-plain package.
 *   - The server's auto-out from this length; the server's plainSponsorRollAutoOut.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  measurePlainSponsorRollPassMs,
  plainSponsorRollEntranceMs,
  planPlainSponsorRollPass,
  sponsorHoldMsOfEachLevel,
} from './sponsorRollPass.js';

/** A sponsor as the entity list of sponsors gives it, with its logo on the media store. */
function buildSponsorWithALogo(
  name: string,
  level: 'diamante' | 'ouro' | 'prata' | 'bronze' | 'apoio' | 'realizacao',
) {
  const logoName = name.toLowerCase().replaceAll(' ', '-');
  return { name, level, logoUrl: `/media/logo-${logoName}.png`, logoOnLightPlate: false };
}

describe('each level’s hold', () => {
  it('holds Diamante longest, Ouro and Realização at 5 s, Prata and Apoio at 3 s', () => {
    // Arrange: nothing; the table is fixed.

    // Act: read it.
    const holds = sponsorHoldMsOfEachLevel;

    // Assert: Ardósia's values, the higher the level the longer.
    expect(holds, 'each level must hold as long as Ardósia says').toEqual({
      diamante: 8000,
      ouro: 5000,
      prata: 3000,
      bronze: 5000,
      apoio: 3000,
      realizacao: 5000,
    });
  });
});

describe('the plan of one pass', () => {
  it('shows each sponsor after the entrance, each for its level’s hold, back to back', () => {
    // Arrange: Bosch (Diamante), Petrobras (Ouro) and SAE Brasil (Realização).
    const sponsors = [
      buildSponsorWithALogo('Bosch', 'diamante'),
      buildSponsorWithALogo('Petrobras', 'ouro'),
      buildSponsorWithALogo('SAE Brasil', 'realizacao'),
    ];

    // Act: plan the pass.
    const plan = planPlainSponsorRollPass(sponsors);

    // Assert: each hold ends where the next begins, the first after the 400 ms entrance.
    const shown = plan.sponsorsShown.map((entry) => ({
      name: entry.sponsor.name,
      holdMs: entry.holdMs,
      holdEndsAtMs: entry.holdEndsAtMs,
    }));
    expect(shown, 'each sponsor must hold for its level, one after the other').toEqual([
      { name: 'Bosch', holdMs: 8000, holdEndsAtMs: 400 + 8000 },
      { name: 'Petrobras', holdMs: 5000, holdEndsAtMs: 400 + 8000 + 5000 },
      { name: 'SAE Brasil', holdMs: 5000, holdEndsAtMs: 400 + 8000 + 5000 + 5000 },
    ]);
    expect(plan.passMs, 'the pass must end with the last sponsor’s hold').toBe(18_400);
  });

  it('measures the same length the plan ends on', () => {
    // Arrange: a Prata and an Apoio sponsor.
    const sponsors = [
      buildSponsorWithALogo('Randon', 'prata'),
      buildSponsorWithALogo('Senai', 'apoio'),
    ];

    // Act: measure the pass, as the server does.
    const passMs = measurePlainSponsorRollPassMs(sponsors);

    // Assert: the entrance and the two 3 s holds.
    expect(passMs, 'the server’s length must be the plan’s').toBe(
      plainSponsorRollEntranceMs + 3000 + 3000,
    );
  });

  it('goes through the levels in the round’s order, whatever order the list comes in', () => {
    // Arrange: a list written by hand in no order, two Ouro sponsors among them.
    const sponsors = [
      buildSponsorWithALogo('SAE Brasil', 'realizacao'),
      buildSponsorWithALogo('Petrobras', 'ouro'),
      buildSponsorWithALogo('Senai', 'apoio'),
      buildSponsorWithALogo('Bosch', 'diamante'),
      buildSponsorWithALogo('Fiat', 'ouro'),
    ];

    // Act: plan the pass.
    const plan = planPlainSponsorRollPass(sponsors);

    // Assert: Diamante first, Realização last, the two Ouro sponsors in the order given.
    const names = plan.sponsorsShown.map((entry) => entry.sponsor.name);
    expect(names, 'the pass must follow the round, keeping the list’s order in a level').toEqual([
      'Bosch',
      'Petrobras',
      'Fiat',
      'Senai',
      'SAE Brasil',
    ]);
  });

  const sponsorsWithoutALogo = [
    // A sponsor imported from a CSV with no logo uploaded yet: the field is left out.
    { name: 'skips a sponsor whose logo is left out', logoUrl: undefined },
    // A literal list typed by hand with the logo emptied.
    { name: 'skips a sponsor whose logo is empty', logoUrl: '' },
    // Spaces only, as a pasted value may be: still nothing to draw.
    { name: 'skips a sponsor whose logo is only spaces', logoUrl: '   ' },
  ];

  it.each(sponsorsWithoutALogo)('$name', ({ logoUrl }) => {
    // Arrange: Bosch with a logo, and Randon without one.
    const randonWithoutALogo = { name: 'Randon', level: 'prata' as const, logoUrl };
    const sponsors = [buildSponsorWithALogo('Bosch', 'diamante'), randonWithoutALogo];

    // Act: plan the pass.
    const plan = planPlainSponsorRollPass(sponsors);

    // Assert: Randon is not in it and adds no time.
    const names = plan.sponsorsShown.map((entry) => entry.sponsor.name);
    expect(names, 'a sponsor with no logo must never be an empty card').toEqual(['Bosch']);
    expect(plan.passMs, 'a skipped sponsor must add no time').toBe(400 + 8000);
  });

  it('is the entrance alone when no sponsor has a logo', () => {
    // Arrange: one sponsor, with no logo.
    const sponsors = [{ name: 'Randon', level: 'prata' as const }];

    // Act: plan the pass.
    const plan = planPlainSponsorRollPass(sponsors);

    // Assert: nothing to show, and the pass ends right after coming in.
    expect(plan.sponsorsShown, 'no sponsor must be shown').toEqual([]);
    expect(plan.passMs, 'the pass must be the entrance alone').toBe(plainSponsorRollEntranceMs);
  });
});

/**
 * Resolving item fields that read the entity library (apps/server)
 *
 * What this module is for:
 *   At the take and at a preview, resolveItemFieldsIntoGraphicData turns an item's fields
 *   into its graphic's data. An entity reference reads one attribute of one record of the
 *   library (BAJAOVRLAY-19): the team of car 42's name, its city, its logo as the image's
 *   URL. The resolver is handed the library as plain data with everything else and reads
 *   nothing itself. A record that is not there refuses the whole take, naming it, as a
 *   missing source does; a missing optional attribute leaves the field out, so the
 *   graphic shows its no-logo state.
 *
 * What these tests prove:
 *   - Car 42's team name and city are read at the take.
 *   - Car 42's logo gives the URL /media/<mediaId>.
 *   - Car 42's choice of the light plate (logoOnLightPlate, BAJAOVRLAY-24) reaches a switch
 *     field as yes; team 7, which made no choice, leaves the switch out (no plate).
 *   - A team that is not in the library refuses the take (ENTITY_NOT_RESOLVED), the
 *     field's title first and the car named.
 *   - Team 7's logo, not uploaded, leaves an optional logo field out, and refuses a take
 *     whose graphic requires the logo.
 *   - A binding to car 42 in the positions and a reference to car 42's team meet in one
 *     item: the team card's case, with no join written anywhere.
 *
 * What these tests deliberately do not cover:
 *   - Bindings alone; resolveItemFieldsWithBindings.test.ts.
 *   - Reading an attribute; entityReferenceResolution.test.ts in shared.
 *   - The refresh on air after an edit; the entity refresh tests of modules/bindings.
 */
import type { ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { resolveItemFieldsIntoGraphicData } from './resolveItemFields.js';
import {
  buildPositionsBinding,
  buildSourcesAtLap34,
  momentOfTheTake,
} from './resolveItemFieldsWithBindings.testSupport.js';
import {
  buildEmptyLibrary,
  buildLibraryWithTeams42And7,
  buildTeamCardGraphic,
  buildTeamCardWithARequiredLogo,
  logoOfTeam42MediaId,
} from './resolveItemFieldsWithEntities.testSupport.js';

/** The team card's fields reading car `carNumber`'s team: name, city and logo. */
function buildTeamCardFieldsOfCar(carNumber: number): ItemFields {
  return {
    teamName: { kind: 'entity', entityType: 'team', carNumber, attribute: 'teamName' },
    city: { kind: 'entity', entityType: 'team', carNumber, attribute: 'city' },
    logoUrl: { kind: 'entity', entityType: 'team', carNumber, attribute: 'logoUrl' },
  };
}

describe('resolveItemFieldsIntoGraphicData with entity references', () => {
  it("reads car 42's team name, city and logo URL at the take", () => {
    // Arrange: the team card reading car 42's team, and a library holding it.
    const fields = buildTeamCardFieldsOfCar(42);

    // Act: resolve it at the take.
    const resolution = resolveItemFieldsIntoGraphicData({
      fields,
      graphic: buildTeamCardGraphic(),
      momentOfTheTake,
      sources: buildSourcesAtLap34([]),
      entities: buildLibraryWithTeams42And7(),
    });

    // Assert: the stored name and city, and the logo as its /media URL.
    expect(resolution, 'the card is filled from the library').toEqual({
      status: 'resolved',
      data: {
        teamName: 'Baja UFPR',
        city: 'Curitiba',
        logoUrl: `/media/${logoOfTeam42MediaId}`,
      },
    });
  });

  it("reads car 42's light plate choice into a switch, and leaves it out for team 7", () => {
    // Arrange: the plate switch reading the plate choice of car 42's team and of car 7's.
    const plateOfCar = (carNumber: number): ItemFields => ({
      teamName: { kind: 'entity', entityType: 'team', carNumber, attribute: 'teamName' },
      logoOnLightPlate: {
        kind: 'entity',
        entityType: 'team',
        carNumber,
        attribute: 'logoOnLightPlate',
      },
    });

    // Act: resolve both at the take.
    const resolveFieldsOfCar = (carNumber: number) =>
      resolveItemFieldsIntoGraphicData({
        fields: plateOfCar(carNumber),
        graphic: buildTeamCardGraphic(),
        momentOfTheTake,
        sources: buildSourcesAtLap34([]),
        entities: buildLibraryWithTeams42And7(),
      });
    const resolutionOfCar42 = resolveFieldsOfCar(42);
    const resolutionOfCar7 = resolveFieldsOfCar(7);

    // Assert: yes for team 42; no switch value at all for team 7, which the card reads as
    // no plate.
    expect(resolutionOfCar42, 'team 42 goes on the plate').toEqual({
      status: 'resolved',
      data: { teamName: 'Baja UFPR', logoOnLightPlate: true },
    });
    expect(resolutionOfCar7, 'team 7 made no choice, so the switch is left out').toEqual({
      status: 'resolved',
      data: { teamName: 'Juriti Off-Road' },
    });
  });

  it('refuses the take of a team the library does not hold, naming the car', () => {
    // Arrange: the team card reading car 42's team, and an empty library (the team was
    // deleted in Cadastros).
    const fields = buildTeamCardFieldsOfCar(42);

    // Act: resolve it.
    const resolution = resolveItemFieldsIntoGraphicData({
      fields,
      graphic: buildTeamCardGraphic(),
      momentOfTheTake,
      sources: buildSourcesAtLap34([]),
      entities: buildEmptyLibrary(),
    });

    // Assert: refused whole, the first field's title before the sentence.
    expect(resolution, 'never a half-filled card').toEqual({
      status: 'refused',
      error: {
        code: 'ENTITY_NOT_RESOLVED',
        message: 'Equipe: a equipe do carro 42 não está nos cadastros.',
      },
    });
  });

  it('leaves the logo out for a team with no logo, so the card shows its no-logo state', () => {
    // Arrange: the team card reading car 7's team, which has no logo yet.
    const fields = buildTeamCardFieldsOfCar(7);

    // Act: resolve it.
    const resolution = resolveItemFieldsIntoGraphicData({
      fields,
      graphic: buildTeamCardGraphic(),
      momentOfTheTake,
      sources: buildSourcesAtLap34([]),
      entities: buildLibraryWithTeams42And7(),
    });

    // Assert: name and city, and no logo key at all.
    expect(resolution, 'an optional logo not uploaded is left out').toEqual({
      status: 'resolved',
      data: { teamName: 'Juriti Off-Road', city: 'Joinville' },
    });
  });

  it('refuses the take when the graphic requires the logo the team does not have', () => {
    // Arrange: a team card that cannot go on air without a logo, reading car 7.
    const fields = buildTeamCardFieldsOfCar(7);

    // Act: resolve it.
    const resolution = resolveItemFieldsIntoGraphicData({
      fields,
      graphic: buildTeamCardWithARequiredLogo(),
      momentOfTheTake,
      sources: buildSourcesAtLap34([]),
      entities: buildLibraryWithTeams42And7(),
    });

    // Assert: refused, naming the logo field and the team.
    expect(resolution, 'a required value absent refuses the take').toEqual({
      status: 'refused',
      error: {
        code: 'ENTITY_NOT_RESOLVED',
        message: 'Logo: Equipe 7 (Juriti Off-Road) não tem Logo.',
      },
    });
  });

  it("joins car 42's laps from the source with its team from the library in one item", () => {
    // Arrange: the team card with the team's name from the library and the laps of the
    // same car from the simulator's positions at lap 34.
    const fields: ItemFields = {
      teamName: { kind: 'entity', entityType: 'team', carNumber: 42, attribute: 'teamName' },
      laps: buildPositionsBinding('entryOfCar.laps', { carNumber: 42 }),
    };
    const sources = buildSourcesAtLap34([]);
    const lapsOfCar42 = sources.dataSnapshots[0]?.shapes.positions?.entries.find(
      (entry) => entry.carNumber === 42,
    )?.laps;

    // Act: resolve it.
    const resolution = resolveItemFieldsIntoGraphicData({
      fields,
      graphic: buildTeamCardGraphic(),
      momentOfTheTake,
      sources,
      entities: buildLibraryWithTeams42And7(),
    });

    // Assert: the car number is the join; nothing else was needed.
    expect(lapsOfCar42, 'car 42 is listed at lap 34').toBeTypeOf('number');
    expect(resolution, 'the name from the library, the laps from the source').toEqual({
      status: 'resolved',
      data: { teamName: 'Baja UFPR', laps: lapsOfCar42 },
    });
  });
});

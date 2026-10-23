/**
 * upsertEntity, deleteEntity and importEntities: changing the entity library (apps/server)
 *
 * What this module is for:
 *   The Cadastros page keeps the library with three commands (BAJAOVRLAY-19).
 *   upsertEntity adds a record or replaces the one of the same key in its place;
 *   deleteEntity removes one by its key; importEntities upserts many records of one type
 *   at once (a CSV's valid rows, the simulator's teams). Each changes only its own slice.
 *
 * What these tests prove:
 *   - A new team is added after the others; a team with a car number already listed is
 *     replaced in its place, the others untouched.
 *   - A person, a sponsor and a schedule slot go to their own slices.
 *   - deleteEntity removes the team of that car and no other; deleting a record that is
 *     not there changes nothing, the very same slices coming back.
 *   - importEntities replaces the teams it names, adds the new ones at the end and keeps
 *     the teams it does not name.
 *   - Upserting a record exactly as stored changes nothing.
 *
 * What these tests deliberately do not cover:
 *   - The rules of each record (car number, UF, tier); entityRecords.test.ts in shared.
 *   - Images in a record (MEDIA_NOT_FOUND); the media tests.
 *   - The event log, the saving and who may send them; entitiesThroughTheStore.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { reduceCommand } from '../../../core/store/reducers/reduceCommand.js';
import { contextOfTheRundownCommand } from '../../../core/store/reducers/rundownSlices.testSupport.js';
import {
  buildMasterAndSupportSponsors,
  buildNarratorAndJudge,
  buildRaceDaySlicesWithEntities,
  buildSaturdayEnduroSlots,
  buildTeam7,
  buildTeam13,
  buildTeam42,
} from '../entitySlices.testSupport.js';

describe('upsertEntity', () => {
  it('adds a new team after the teams already listed', () => {
    // Arrange: a library with team 42 only.
    const slicesBefore = buildRaceDaySlicesWithEntities({ teams: [buildTeam42()] });

    // Act: the operator saves team 7.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'upsertEntity', entityType: 'team', record: buildTeam7() },
      contextOfTheRundownCommand,
    );

    // Assert: team 7 is added after team 42.
    expect(outcome.status, 'the upsert must be applied').toBe('applied');
    expect(
      outcome.status === 'applied' && outcome.slices.teams.map((team) => team.carNumber),
      'team 7 must come after team 42',
    ).toEqual([42, 7]);
  });

  it('replaces the team of a car already listed, in its place', () => {
    // Arrange: teams 42 and 7, in that order.
    const slicesBefore = buildRaceDaySlicesWithEntities({ teams: [buildTeam42(), buildTeam7()] });

    // Act: the team of car 42 is renamed.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'upsertEntity',
        entityType: 'team',
        record: { ...buildTeam42(), teamName: 'Baja UFPR Racing' },
      },
      contextOfTheRundownCommand,
    );

    // Assert: car 42 keeps its place with the new name; car 7 is untouched.
    expect(outcome.status === 'applied' && outcome.slices.teams, 'one team per car').toEqual([
      { ...buildTeam42(), teamName: 'Baja UFPR Racing' },
      buildTeam7(),
    ]);
  });

  it('puts a person, a sponsor and a schedule slot each in its own slice', () => {
    // Arrange: an empty library.
    const slicesBefore = buildRaceDaySlicesWithEntities({});
    const [narrator] = buildNarratorAndJudge();
    const [masterSponsor] = buildMasterAndSupportSponsors();
    const [enduroSlot] = buildSaturdayEnduroSlots();
    if (narrator === undefined || masterSponsor === undefined || enduroSlot === undefined) {
      throw new Error('the factories must build one record each');
    }

    // Act: save the three, one after the other.
    let slices = slicesBefore;
    const upserts = [
      { type: 'upsertEntity' as const, entityType: 'person' as const, record: narrator },
      { type: 'upsertEntity' as const, entityType: 'sponsor' as const, record: masterSponsor },
      { type: 'upsertEntity' as const, entityType: 'scheduleSlot' as const, record: enduroSlot },
    ];
    for (const upsert of upserts) {
      const outcome = reduceCommand(slices, upsert, contextOfTheRundownCommand);
      if (outcome.status !== 'applied') {
        throw new Error(`the upsert of a ${upsert.entityType} was refused`);
      }
      slices = outcome.slices;
    }

    // Assert: each record in its slice, and the teams untouched.
    expect(slices.people, 'the narrator goes to people').toEqual([narrator]);
    expect(slices.sponsors, 'the sponsor goes to sponsors').toEqual([masterSponsor]);
    expect(slices.scheduleSlots, 'the slot goes to scheduleSlots').toEqual([enduroSlot]);
    expect(slices.teams, 'the teams must be the very same list').toBe(slicesBefore.teams);
  });

  it('changes nothing when the record is saved exactly as stored', () => {
    // Arrange: team 42 stored.
    const slicesBefore = buildRaceDaySlicesWithEntities({ teams: [buildTeam42()] });

    // Act: "Salvar" again with nothing changed.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'upsertEntity', entityType: 'team', record: buildTeam42() },
      contextOfTheRundownCommand,
    );

    // Assert: the very same slices, so nothing is saved, logged or broadcast.
    expect(outcome.status === 'applied' && outcome.slices, 'nothing changed').toBe(slicesBefore);
  });
});

describe('deleteEntity', () => {
  it('removes the team of that car and no other', () => {
    // Arrange: teams 42 and 7.
    const slicesBefore = buildRaceDaySlicesWithEntities({ teams: [buildTeam42(), buildTeam7()] });

    // Act: "Excluir" twice on the row of car 42.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'deleteEntity', entityType: 'team', carNumber: 42 },
      contextOfTheRundownCommand,
    );

    // Assert: only team 7 is left.
    expect(outcome.status === 'applied' && outcome.slices.teams, 'team 7 stays').toEqual([
      buildTeam7(),
    ]);
  });

  it('removes a person by its id', () => {
    // Arrange: the narrator and the judge.
    const slicesBefore = buildRaceDaySlicesWithEntities({ people: buildNarratorAndJudge() });

    // Act: delete the judge.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'deleteEntity', entityType: 'person', personId: 'juiz-seguranca' },
      contextOfTheRundownCommand,
    );

    // Assert: the narrator is left.
    expect(
      outcome.status === 'applied' && outcome.slices.people.map((person) => person.personId),
      'only the narrator stays',
    ).toEqual(['narrador-joao']);
  });

  it('changes nothing when the record is not there', () => {
    // Arrange: team 42 only.
    const slicesBefore = buildRaceDaySlicesWithEntities({ teams: [buildTeam42()] });

    // Act: delete car 99, which has no team (a second press on another page, perhaps).
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'deleteEntity', entityType: 'team', carNumber: 99 },
      contextOfTheRundownCommand,
    );

    // Assert: accepted, with the very same slices.
    expect(outcome.status, 'a delete of nothing is answered ok').toBe('applied');
    expect(outcome.status === 'applied' && outcome.slices, 'nothing changed').toBe(slicesBefore);
  });
});

describe('importEntities', () => {
  it('replaces the teams it names, adds the new ones and keeps the others', () => {
    // Arrange: teams 42 and 7 stored.
    const slicesBefore = buildRaceDaySlicesWithEntities({ teams: [buildTeam42(), buildTeam7()] });

    // Act: import a CSV with car 7 renamed and the new car 13.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'importEntities',
        entityType: 'team',
        records: [{ ...buildTeam7(), teamName: 'Juriti Racing' }, buildTeam13()],
      },
      contextOfTheRundownCommand,
    );

    // Assert: 42 kept, 7 replaced in its place, 13 added at the end.
    expect(outcome.status === 'applied' && outcome.slices.teams, 'the merged teams').toEqual([
      buildTeam42(),
      { ...buildTeam7(), teamName: 'Juriti Racing' },
      buildTeam13(),
    ]);
  });
});

/**
 * Saving an item whose fields read the entity library (apps/server)
 *
 * What this module is for:
 *   createItem and updateItemFields check every entity reference they carry before the
 *   item is stored (BAJAOVRLAY-19), so a mistake is heard while the show is prepared, not
 *   at the press of Space on air: the record must be in the library now, the attribute
 *   must exist for its kind of record, and its value must fit the field (an image only
 *   on an image field). Each refusal is INVALID_ENTITY_REFERENCE with the field's title
 *   first, the same sentence the item editor shows.
 *
 * What these tests prove:
 *   - A team card reading car 42's name and logo is created.
 *   - A reference to a team the library does not hold, a logo on a text field and an
 *     attribute teams do not have are refused, each naming the field and the reason.
 *   - updateItemFields refuses a reference to a team the library does not hold.
 *
 * What these tests deliberately do not cover:
 *   - Deleting the team afterwards: the take refuses then (the resolver tests).
 *   - Each rule of the fit; entityFitsGraphicField.test.ts in shared.
 */
import type { CreateItemCommand, EntityFieldValue, Item } from '@bajaovrlay/shared';
import { buildFakeMediaId } from '@bajaovrlay/shared/fakeMediaIds.testSupport';
import { describe, expect, it } from 'vitest';

import { buildTeam7, buildTeam42 } from '../../../modules/entities/entitySlices.testSupport.js';
import { buildTeamCardGraphic } from '../resolveItemFieldsWithEntities.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import type { SlicesChangedByCommands } from './reducerTypes.js';
import {
  buildRaceDaySlicesWithRundown,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';

/** The logo of team 42, as the media store holds it. */
const logoOfTeam42MediaId = buildFakeMediaId(3);

/** A race day with the team card registered, teams 42 and 7, and team 42's logo stored. */
function buildSlicesWithTheTeamCard(items: Item[] = []): SlicesChangedByCommands {
  return {
    ...buildRaceDaySlicesWithRundown({ items }),
    graphics: [buildTeamCardGraphic()],
    teams: [{ ...buildTeam42(), logoMediaId: logoOfTeam42MediaId }, buildTeam7()],
    media: [
      {
        mediaId: logoOfTeam42MediaId,
        fileName: 'logo-ufpr.png',
        contentType: 'image/png',
        sizeBytes: 18_204,
        widthPx: 512,
        heightPx: 512,
        uploadedAt: '2026-11-13T21:40:00.000Z',
      },
    ],
  };
}

/** A reference to one attribute of the team of car `carNumber`. */
function buildTeamReference(carNumber: number, attribute: string): EntityFieldValue {
  return { kind: 'entity', entityType: 'team', carNumber, attribute };
}

/** The createItem "Salvar item" sends for a team card with these fields. */
function buildCreateTeamCard(fields: CreateItemCommand['fields']): CreateItemCommand {
  return {
    type: 'createItem',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    graphicId: 'team-card',
    layerId: 'lower-third',
    fields,
    label: 'Cartão da equipe 42',
    color: 'info',
    notes: '',
  };
}

describe('createItem with entity references', () => {
  it("creates a team card reading car 42's name and logo", () => {
    // Arrange: the race day with the team card and team 42.
    const slicesBefore = buildSlicesWithTheTeamCard();

    // Act: save the card.
    const outcome = reduceCommand(
      slicesBefore,
      buildCreateTeamCard({
        teamName: buildTeamReference(42, 'teamName'),
        logoUrl: buildTeamReference(42, 'logoUrl'),
      }),
      contextOfTheRundownCommand,
    );

    // Assert: stored with its references as sent.
    expect(outcome.status, 'the card is saved').toBe('applied');
    expect(
      outcome.status === 'applied' && outcome.slices.items.at(-1)?.fields,
      'the references are stored as sent',
    ).toEqual({
      teamName: buildTeamReference(42, 'teamName'),
      logoUrl: buildTeamReference(42, 'logoUrl'),
    });
  });

  const refusedReferences = [
    // A car whose team was never typed in Cadastros.
    {
      name: 'refuses a team the library does not hold',
      fields: { teamName: buildTeamReference(99, 'teamName') },
      expectedMessage: 'Equipe: a equipe do carro 99 não está nos cadastros.',
    },
    // A URL on a title would print the address as the team's name.
    {
      name: 'refuses a logo on a text field',
      fields: { teamName: buildTeamReference(42, 'logoUrl') },
      expectedMessage: 'Equipe: Equipe › Logo não serve para este campo.',
    },
    // Teams have no points; that is the standings' business.
    {
      name: 'refuses an attribute teams do not have',
      fields: { teamName: buildTeamReference(42, 'points') },
      expectedMessage: 'Equipe: o cadastro de Equipe não tem o campo "points".',
    },
  ];

  it.each(refusedReferences)('$name', ({ fields, expectedMessage }) => {
    // Arrange: the race day with the team card and teams 42 and 7.
    const slicesBefore = buildSlicesWithTheTeamCard();

    // Act: try to save a card with the reference of this row.
    const outcome = reduceCommand(
      slicesBefore,
      buildCreateTeamCard(fields),
      contextOfTheRundownCommand,
    );

    // Assert: refused with the field's title first, nothing stored.
    expect(outcome, 'the reference must be refused at the save').toEqual({
      status: 'refused',
      error: { code: 'INVALID_ENTITY_REFERENCE', message: expectedMessage },
    });
  });
});

describe('updateItemFields with entity references', () => {
  it('refuses switching the card to a team the library does not hold', () => {
    // Arrange: a stored card of car 42.
    const cardOfCar42: Item = {
      id: 'item-cartao-42',
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
      order: 0,
      graphicId: 'team-card',
      layerId: 'lower-third',
      fields: { teamName: buildTeamReference(42, 'teamName') },
      label: 'Cartão da equipe 42',
      color: 'info',
      notes: '',
    };
    const slicesBefore = buildSlicesWithTheTeamCard([cardOfCar42]);

    // Act: point it at car 99.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'updateItemFields',
        itemId: 'item-cartao-42',
        fields: { teamName: buildTeamReference(99, 'teamName') },
      },
      contextOfTheRundownCommand,
    );

    // Assert: refused, naming the field and the car.
    expect(outcome, 'the update must be refused').toEqual({
      status: 'refused',
      error: {
        code: 'INVALID_ENTITY_REFERENCE',
        message: 'Equipe: a equipe do carro 99 não está nos cadastros.',
      },
    });
  });
});

/**
 * Where an item is ahead of the air: "item mudou" in Camadas (packages/shared)
 *
 * What this module is for:
 *   An instance on air shows the values its item had at the take. When the operator saves
 *   the item afterwards (a new name, a new role), the air is behind the item. Camadas marks
 *   that row "item mudou" and offers to catch up. The function under test answers which
 *   fields are behind, from the instance, its item and its graphic, and nothing else: it
 *   is the reverse of "alterado no ar", which marks a change made on air that the item
 *   does not have.
 *
 * What these tests prove, one named scenario per row:
 *   - A field the item holds as typed text or number is behind when the air shows
 *     something else, and only then; a field left out on air counts as the same as an
 *     item's empty value, the way a take leaves an empty value out.
 *   - A field the item no longer stores counts as empty, as the server counts it: it is
 *     behind while the air still shows a value for it, after the fields the item stores.
 *   - A field the item does not type (read from a source, from the library, as a whole list,
 *     or stamped at the take) is never behind, whatever the air shows.
 *   - A clock is never behind, in any of its four parts (gate 2 of PR #49): its update
 *     rule writes its reference on the server, so "the air matches the item" cannot be
 *     read field by field. The other fields of a clock graphic still count.
 *   - A field changed on air is left to "alterado no ar", so the two marks never name the
 *     same field.
 *   - A key on air that the graphic does not declare is never named.
 *   - An instance whose item was deleted, an instance with no item and an instance of a
 *     graphic no longer listed are never behind.
 *
 * What these tests deliberately do not cover:
 *   - The chip, its tooltip and its two buttons: apps/control's
 *     LayerStatusPanelItemAheadOfTheAir.test.tsx.
 *   - What the server does with the update the buttons send: the updateInstanceData
 *     reducer tests in apps/server.
 */
import { describe, expect, it } from 'vitest';

import { buildRaceClockGraphicFromItsManifest } from '../bindings/graphicsForBindingTests.testSupport.js';
import type { Graphic } from '../slices/graphic.js';
import type { ItemFields } from './fieldValue.js';
import { findWhereTheItemIsAheadOfTheAir } from './itemAheadOfTheAir.js';
import {
  buildAnaSouzaFields,
  buildAnaSouzaFieldsSavedWithoutARole,
  buildEnduranceClockAsTaken,
  buildEnduranceClockFields,
  buildInstanceOnProgramShowing,
  buildInterviewLowerThirdGraphic,
  buildItemOfGraphic,
  buildSponsorRollGraphic,
  momentOfTheTakeInMilliseconds,
} from './itemAheadOfTheAir.testSupport.js';

/** One scenario: an item, what its instance shows, and the fields expected to be behind. */
type ItemAheadScenario = {
  name: string;
  graphic: Graphic;
  itemFields: ItemFields;
  dataOnAir: Record<string, unknown>;
  fieldsChangedOnAir?: string[];
  expectedKeysBehind: string[];
  why: string;
};

const itemAheadScenarios: ItemAheadScenario[] = [
  // The everyday case the brief starts from: the name was corrected in the item after the take.
  {
    name: 'names the name when the item was saved with a new one after the take',
    graphic: buildInterviewLowerThirdGraphic(),
    itemFields: {
      ...buildAnaSouzaFields(),
      nome: { kind: 'literal', value: 'Ana Souza Lima' },
    },
    dataOnAir: { nome: 'Ana Souza', funcao: 'Capitã', equipe: 'Baja UFPR', posicao: 3 },
    expectedKeysBehind: ['nome'],
    why: 'the name on air is the one from before the save',
  },
  // Two fields saved at once come back in the item's order, for the tooltip.
  {
    name: 'names the name and the role, in the item order, when both were saved',
    graphic: buildInterviewLowerThirdGraphic(),
    itemFields: {
      ...buildAnaSouzaFields(),
      nome: { kind: 'literal', value: 'Ana Souza Lima' },
      funcao: { kind: 'literal', value: 'Piloto' },
    },
    dataOnAir: { nome: 'Ana Souza', funcao: 'Capitã', equipe: 'Baja UFPR', posicao: 3 },
    expectedKeysBehind: ['nome', 'funcao'],
    why: 'both typed fields on air are older than the item',
  },
  // Nothing saved since the take: the row must stay quiet.
  {
    name: 'names nothing when the air shows what the item holds',
    graphic: buildInterviewLowerThirdGraphic(),
    itemFields: buildAnaSouzaFields(),
    dataOnAir: { nome: 'Ana Souza', funcao: 'Capitã', equipe: 'Baja UFPR', posicao: 3 },
    expectedKeysBehind: [],
    why: 'the air matches the item',
  },
  // A source poll moves a bound value on air; the item still says "read the source".
  {
    name: 'never names a field the item reads from a source, whatever the air shows',
    graphic: buildInterviewLowerThirdGraphic(),
    itemFields: buildAnaSouzaFields(),
    dataOnAir: { nome: 'Ana Souza', funcao: 'Capitã', equipe: 'Baja UFPR', posicao: 2 },
    expectedKeysBehind: [],
    why: 'a bound field follows its source, it is never behind the item',
  },
  // The two marks must never claim the same field: this one belongs to "alterado no ar".
  {
    name: 'leaves out a field changed on air even when the item changed it too',
    graphic: buildInterviewLowerThirdGraphic(),
    itemFields: {
      ...buildAnaSouzaFields(),
      nome: { kind: 'literal', value: 'Ana Souza Lima' },
      funcao: { kind: 'literal', value: 'Piloto' },
    },
    dataOnAir: { nome: 'Ana S.', funcao: 'Capitã', equipe: 'Baja UFPR', posicao: 3 },
    fieldsChangedOnAir: ['nome'],
    expectedKeysBehind: ['funcao'],
    why: 'the name was retyped on air, so only the role is the item being ahead',
  },
  // A take leaves an empty value out of the data; the two are the same thing.
  {
    name: 'counts a field left out on air as the same as an item value left empty',
    graphic: buildInterviewLowerThirdGraphic(),
    itemFields: { ...buildAnaSouzaFields(), equipe: { kind: 'literal', value: null } },
    dataOnAir: { nome: 'Ana Souza', funcao: 'Capitã', posicao: 3 },
    expectedKeysBehind: [],
    why: 'an empty team in the item and no team on air show the same thing',
  },
  // The item emptied a field the air still shows: catching up takes it off air.
  {
    name: 'names a field the item emptied while the air still shows it',
    graphic: buildInterviewLowerThirdGraphic(),
    itemFields: { ...buildAnaSouzaFields(), equipe: { kind: 'literal', value: null } },
    dataOnAir: { nome: 'Ana Souza', funcao: 'Capitã', equipe: 'Baja UFPR', posicao: 3 },
    expectedKeysBehind: ['equipe'],
    why: 'the team is still on air but the item no longer has one',
  },
  // The item gained a value for a field the take left out.
  {
    name: 'names a field the item filled in after the take',
    graphic: buildRaceClockGraphicFromItsManifest(),
    itemFields: {
      ...buildEnduranceClockFields(),
      lapsCompletedByLeader: { kind: 'literal', value: 7 },
    },
    dataOnAir: buildEnduranceClockAsTaken(),
    expectedKeysBehind: ['lapsCompletedByLeader'],
    why: 'seven laps were typed into the item; the air shows no laps',
  },
  // Gate 2 of PR #49: the clock's update rule writes its reference on the server, so a
  // clock is never named, even with a new time typed into the item.
  {
    name: 'never names the clock when the item was given a new time',
    graphic: buildRaceClockGraphicFromItsManifest(),
    itemFields: {
      ...buildEnduranceClockFields(),
      referenceTimeMs: { kind: 'literal', value: 10_800_000 },
    },
    dataOnAir: buildEnduranceClockAsTaken(),
    expectedKeysBehind: [],
    why: 'a clock changed in the item reaches air with the next take, not from this mark',
  },
  // "The moment of the take" is never a value the air can be behind.
  {
    name: 'never names a clock moment the item leaves to the take',
    graphic: buildRaceClockGraphicFromItsManifest(),
    itemFields: buildEnduranceClockFields(),
    dataOnAir: buildEnduranceClockAsTaken(),
    expectedKeysBehind: [],
    why: 'the stamped moment differs from the item by nature',
  },
  // The other three parts of the clock, typed anew in the item, are left out the same way.
  {
    name: 'never names the clock when the item was given a new mode, moment and switch',
    graphic: buildRaceClockGraphicFromItsManifest(),
    itemFields: {
      ...buildEnduranceClockFields(),
      clockMode: { kind: 'literal', value: 'elapsed' },
      referenceWallClockMs: { kind: 'literal', value: momentOfTheTakeInMilliseconds + 60_000 },
      running: { kind: 'literal', value: true },
    },
    dataOnAir: buildEnduranceClockAsTaken(),
    expectedKeysBehind: [],
    why: 'no part of a clock is ever reported behind',
  },
  // The clock was started on air: the server's rule rewrote its time and moment without
  // listing them; the clock stays out of this mark all the same.
  {
    name: 'never names a clock started on air, whose time the server moved',
    graphic: buildRaceClockGraphicFromItsManifest(),
    itemFields: buildEnduranceClockFields(),
    dataOnAir: {
      ...buildEnduranceClockAsTaken(),
      running: false,
      referenceTimeMs: 13_950_000,
      referenceWallClockMs: momentOfTheTakeInMilliseconds + 450_000,
    },
    fieldsChangedOnAir: ['running'],
    expectedKeysBehind: [],
    why: 'the time on air moved with the clock, not because the item changed',
  },
  // A clock graphic's other fields still count: the laps typed in are behind, the new time is not.
  {
    name: 'names the laps but not the clock when the item changed both',
    graphic: buildRaceClockGraphicFromItsManifest(),
    itemFields: {
      ...buildEnduranceClockFields(),
      referenceTimeMs: { kind: 'literal', value: 10_800_000 },
      lapsCompletedByLeader: { kind: 'literal', value: 7 },
    },
    dataOnAir: buildEnduranceClockAsTaken(),
    expectedKeysBehind: ['lapsCompletedByLeader'],
    why: 'only the clock leaves this mark; the laps are an ordinary typed field',
  },
  // The item no longer stores the role at all; the server counts that as an empty value.
  {
    name: 'names a field the item no longer stores while the air still shows it',
    graphic: buildInterviewLowerThirdGraphic(),
    itemFields: buildAnaSouzaFieldsSavedWithoutARole('Ana Souza Lima'),
    dataOnAir: { nome: 'Ana Souza', funcao: 'Capitã', equipe: 'Baja UFPR', posicao: 3 },
    expectedKeysBehind: ['nome', 'funcao'],
    why: 'the role is still on air but the item gives none; the item keys come first',
  },
  // A key the item no longer stores and the air shows empty: both say nothing.
  {
    name: 'names nothing for a field the item no longer stores and the air shows empty',
    graphic: buildInterviewLowerThirdGraphic(),
    itemFields: buildAnaSouzaFieldsSavedWithoutARole('Ana Souza'),
    dataOnAir: { nome: 'Ana Souza', funcao: null, equipe: 'Baja UFPR', posicao: 3 },
    expectedKeysBehind: [],
    why: 'an empty role on air is what an item with no role gives',
  },
  // A key the graphic no longer declares (an older package) cannot be named or updated.
  {
    name: 'never names a key on air that the graphic does not declare',
    graphic: buildInterviewLowerThirdGraphic(),
    itemFields: buildAnaSouzaFields(),
    dataOnAir: {
      nome: 'Ana Souza',
      funcao: 'Capitã',
      equipe: 'Baja UFPR',
      posicao: 3,
      apelido: 'Aninha',
    },
    expectedKeysBehind: [],
    why: 'a field the graphic has no title for is left alone',
  },
  // A whole list read from the library is refreshed by the server, never typed.
  {
    name: 'never names an entity list, whatever the air shows',
    graphic: buildSponsorRollGraphic(),
    itemFields: {
      titulo: { kind: 'literal', value: 'Nossos patrocinadores' },
      patrocinadores: { kind: 'entityList', entityType: 'sponsor' },
    },
    dataOnAir: {
      titulo: 'Nossos patrocinadores',
      patrocinadores: [{ name: 'Metalúrgica Paraná' }],
    },
    expectedKeysBehind: [],
    why: 'the sponsor list follows the library, the item holds no list of its own',
  },
];

describe('findWhereTheItemIsAheadOfTheAir', () => {
  it.each(itemAheadScenarios)(
    '$name',
    ({ graphic, itemFields, dataOnAir, fieldsChangedOnAir, expectedKeysBehind, why }) => {
      // Arrange: the item as saved now, and its instance as the take left it.
      const item = buildItemOfGraphic(graphic, itemFields);
      const instance = buildInstanceOnProgramShowing(item, dataOnAir, fieldsChangedOnAir);

      // Act: ask where the item is ahead of the air.
      const keysBehind = findWhereTheItemIsAheadOfTheAir(instance, item, graphic);

      // Assert: exactly the expected fields, for the reason the row gives.
      expect(keysBehind, why).toEqual(expectedKeysBehind);
    },
  );

  it('names nothing for an instance whose item was deleted ("item excluído" stays)', () => {
    // Arrange: Ana Souza's lower third on air, its item since deleted.
    const graphic = buildInterviewLowerThirdGraphic();
    const deletedItem = buildItemOfGraphic(graphic, buildAnaSouzaFields());
    const instance = buildInstanceOnProgramShowing(deletedItem, { nome: 'Ana S.' });

    // Act: ask with no item, as the page does when the items slice no longer holds it.
    const keysBehind = findWhereTheItemIsAheadOfTheAir(instance, undefined, graphic);

    // Assert: nothing is behind a deleted item.
    expect(keysBehind, 'a deleted item cannot be ahead of the air').toEqual([]);
  });

  it('names nothing for an instance with no item ("sem item")', () => {
    // Arrange: a lower third put on air by hand before every take came from an item.
    const graphic = buildInterviewLowerThirdGraphic();
    const item = buildItemOfGraphic(graphic, buildAnaSouzaFields());
    const instanceWithoutItem = buildInstanceOnProgramShowing(item, { nome: 'Ana S.' });
    delete instanceWithoutItem.itemId;

    // Act: ask, even handing an item in by mistake.
    const keysBehind = findWhereTheItemIsAheadOfTheAir(instanceWithoutItem, item, graphic);

    // Assert: an instance of no item has nothing to be behind.
    expect(keysBehind, 'an instance with no item is never behind one').toEqual([]);
  });

  it('names nothing when handed an item other than the one the instance came from', () => {
    // Arrange: Ana Souza's lower third on air, and another lower third item.
    const graphic = buildInterviewLowerThirdGraphic();
    const itemOnAir = buildItemOfGraphic(graphic, buildAnaSouzaFields());
    const instance = buildInstanceOnProgramShowing(itemOnAir, { nome: 'Ana Souza' });
    const otherItem = { ...itemOnAir, id: 'item-tarja-do-chefe-de-equipe' };

    // Act: ask with the other item.
    const keysBehind = findWhereTheItemIsAheadOfTheAir(instance, otherItem, graphic);

    // Assert: another item says nothing about this instance.
    expect(keysBehind, 'only the instance own item can be ahead of it').toEqual([]);
  });

  it('names nothing for an instance whose graphic is no longer listed', () => {
    // Arrange: Ana Souza's lower third on air with a new name in the item, the package removed.
    const graphic = buildInterviewLowerThirdGraphic();
    const item = buildItemOfGraphic(graphic, {
      ...buildAnaSouzaFields(),
      nome: { kind: 'literal', value: 'Ana Souza Lima' },
    });
    const instance = buildInstanceOnProgramShowing(item, { nome: 'Ana Souza' });

    // Act: ask without the graphic.
    const keysBehind = findWhereTheItemIsAheadOfTheAir(instance, item, undefined);

    // Assert: with no graphic there is neither a take nor an update to offer.
    expect(keysBehind, 'an instance of an unlisted graphic is never marked').toEqual([]);
  });
});

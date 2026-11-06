/**
 * A deleted item does not jam undo (apps/server)
 *
 * What this module is for:
 *   The program history (programHistory, BAJAOVRLAY-30) names the items each layer showed
 *   before its last changes. An item deleted since can never come back, so a history entry
 *   naming it would be refused on every press and never forgotten: "Desfazer" on its layer
 *   would be dead, and "Desfazer última" and Ctrl+Z refused everywhere until some other
 *   change. So when an item is deleted, every entry naming it is forgotten, as a deleted
 *   layer's history is (gate 2 of PR #44).
 *
 * What these tests prove (through reduceCommand, the pure step every command takes):
 *   - Deleting the item a layer's last change names: "Desfazer" goes one change further back.
 *   - After "Limpar tudo" and the delete of one of the items it took off, "Desfazer última"
 *     still brings back the other layers.
 *   - An entry naming the deleted item is forgotten on every layer, not only the last one.
 *
 * What these tests deliberately do not cover:
 *   - A graphic gone from the build at a restart; storeProgramHistory.test.ts, with a real
 *     graphics folder.
 *   - The refusal kept for an entry that still names a missing item;
 *     undoLastChangeOnProgram.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  applyCommandsOneAfterTheOther,
  buildAnaSouzaLowerThirdItem,
  buildBrunoLimaLowerThirdItem,
  buildRaceDayWithTheFourButtons,
  countChangesRememberedOnLayer,
  readWhatProgramShowsOnLayer,
} from './programHistorySlices.testSupport.js';

const anaSouzaItemId = buildAnaSouzaLowerThirdItem().id;
const brunoLimaItemId = buildBrunoLimaLowerThirdItem().id;

describe('undo after an item is deleted', () => {
  it('goes one change further back on a layer whose last change named the deleted item', () => {
    // Arrange: Ana Souza taken on the empty "Tarja" layer, Bruno Lima taken over her, and
    // then her item deleted from "Atalhos".
    const slicesWithoutHerItem = applyCommandsOneAfterTheOther(buildRaceDayWithTheFourButtons(), [
      { type: 'takeItem', itemId: anaSouzaItemId },
      { type: 'takeItem', itemId: brunoLimaItemId },
      { type: 'deleteItem', itemId: anaSouzaItemId },
    ]);

    // Act: press "Desfazer" on the "Tarja" row.
    const slicesAfterTheUndo = applyCommandsOneAfterTheOther(
      slicesWithoutHerItem,
      [{ type: 'undoOnLayer', layerId: 'lower-third' }],
      4,
    );

    // Assert: the undo is accepted and goes back to what was there before her: nothing.
    expect(
      readWhatProgramShowsOnLayer(slicesAfterTheUndo, 'lower-third'),
      'with her change forgotten, the undo must go back to the empty layer before her',
    ).toBeUndefined();
    expect(
      countChangesRememberedOnLayer(slicesAfterTheUndo, 'lower-third'),
      'the layer has nothing more to undo',
    ).toBe(0);
  });

  it('lets "Desfazer última" bring back the other layers after a "Limpar tudo"', () => {
    // Arrange: the clock and Ana Souza on air, "Limpar tudo", then her item deleted.
    const slicesWithoutHerItem = applyCommandsOneAfterTheOther(buildRaceDayWithTheFourButtons(), [
      { type: 'takeItem', itemId: 'item-relogio-enduro' },
      { type: 'takeItem', itemId: anaSouzaItemId },
      { type: 'clearAll' },
      { type: 'deleteItem', itemId: anaSouzaItemId },
    ]);

    // Act: press "Desfazer última".
    const slicesAfterTheUndo = applyCommandsOneAfterTheOther(
      slicesWithoutHerItem,
      [{ type: 'undoLastChangeOnProgram' }],
      5,
    );

    // Assert: the clock is back; the "Tarja" layer stays empty, since she cannot come back.
    expect(
      readWhatProgramShowsOnLayer(slicesAfterTheUndo, 'clock')?.itemId,
      'the clock "Limpar tudo" took off must come back',
    ).toBe('item-relogio-enduro');
    expect(
      readWhatProgramShowsOnLayer(slicesAfterTheUndo, 'lower-third'),
      'the deleted lower third cannot come back, and nothing else may come in its place',
    ).toBeUndefined();
  });

  it('forgets the deleted item on every layer that remembers it, wherever it is in the list', () => {
    // Arrange: Ana Souza taken, replaced by Bruno Lima and "Limpar" on "Tarja", so her entry
    // sits in the middle there; then both moved to "Aviso", where she is taken and replaced
    // by him again.
    const raceDayWithBothOnTheNoticeLayerToo = applyCommandsOneAfterTheOther(
      buildRaceDayWithTheFourButtons(),
      [
        { type: 'takeItem', itemId: anaSouzaItemId },
        { type: 'takeItem', itemId: brunoLimaItemId },
        { type: 'clearLayer', layerId: 'lower-third' },
      ],
    );
    const slicesWithItemsOnTheNoticeLayer = {
      ...raceDayWithBothOnTheNoticeLayerToo,
      items: raceDayWithBothOnTheNoticeLayerToo.items.map((item) =>
        item.id === anaSouzaItemId || item.id === brunoLimaItemId
          ? { ...item, layerId: 'notice' }
          : item,
      ),
    };
    const slicesBeforeTheDelete = applyCommandsOneAfterTheOther(
      slicesWithItemsOnTheNoticeLayer,
      [
        { type: 'takeItem', itemId: anaSouzaItemId },
        { type: 'takeItem', itemId: brunoLimaItemId },
      ],
      4,
    );

    // Act: delete her item.
    const slicesAfterTheDelete = applyCommandsOneAfterTheOther(
      slicesBeforeTheDelete,
      [{ type: 'deleteItem', itemId: anaSouzaItemId }],
      6,
    );

    // Assert: no layer remembers her any more; the other changes are all still there.
    const itemIdsRemembered = slicesAfterTheDelete.programHistory.flatMap((layerHistory) =>
      layerHistory.entries.map((entry) =>
        entry.shownBefore.kind === 'item' ? entry.shownBefore.itemId : 'vazio',
      ),
    );
    expect(
      itemIdsRemembered,
      'every entry naming her must be gone, every other entry kept in its order',
    ).toEqual(['vazio', brunoLimaItemId, 'vazio']);
  });
});

/**
 * "Desfazer última" and the refusals of an undo (apps/server)
 *
 * What this module is for:
 *   undoLastChangeOnProgram ("Desfazer última", Ctrl+Z; BAJAOVRLAY-30) undoes the newest
 *   change of program across every layer, all the layers it touched at once, so a "Limpar
 *   tudo" by mistake comes back in one press. An undo that cannot be done is refused in
 *   pt-BR and changes nothing.
 *
 * What these tests prove (through reduceCommand, the pure step every command takes):
 *   - "Limpar tudo" with three layers on air: one "Desfazer última" brings back all three.
 *   - With layers changed at different moments, only the newest change is undone.
 *   - An item deleted since, a graphic no longer listed and a layer with nothing to undo
 *     are refused in pt-BR; "Desfazer última" with nothing remembered is refused too.
 *   - If one layer of the newest change cannot come back, none does.
 *
 * What these tests deliberately do not cover:
 *   - "Desfazer" on one layer; undoOnLayer.test.ts.
 *   - The one event-log row and one broadcast of an undo; storeProgramHistory.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { reduceCommand } from '../reducers/reduceCommand.js';
import {
  applyCommandsOneAfterTheOther,
  buildAnaSouzaLowerThirdItem,
  buildBrunoLimaLowerThirdItem,
  buildContextOfCommandNumber,
  buildRaceDayWithTheFourButtons,
  readWhatProgramShowsOnLayer,
} from './programHistorySlices.testSupport.js';

const anaSouzaItemId = buildAnaSouzaLowerThirdItem().id;
const brunoLimaItemId = buildBrunoLimaLowerThirdItem().id;

describe('undoLastChangeOnProgram, "Desfazer última" and Ctrl+Z', () => {
  it('brings back all three layers a "Limpar tudo" emptied, in one press', () => {
    // Arrange: the clock, Ana Souza and the fastest-lap notice on air, then "Limpar tudo".
    const slicesAfterClearAll = applyCommandsOneAfterTheOther(buildRaceDayWithTheFourButtons(), [
      { type: 'takeItem', itemId: 'item-relogio-enduro' },
      { type: 'takeItem', itemId: anaSouzaItemId },
      { type: 'takeItem', itemId: 'item-aviso-melhor-volta' },
      { type: 'clearAll' },
    ]);

    // Act: press "Desfazer última" once.
    const outcome = reduceCommand(
      slicesAfterClearAll,
      { type: 'undoLastChangeOnProgram' },
      buildContextOfCommandNumber(5),
    );

    // Assert: one accepted command, and all three layers show again what they showed.
    expect(outcome.status, 'one press must be accepted').toBe('applied');
    const slicesAfterTheUndo = outcome.status === 'applied' ? outcome.slices : slicesAfterClearAll;
    const itemsBackOnAir = ['clock', 'lower-third', 'notice'].map(
      (layerId) => readWhatProgramShowsOnLayer(slicesAfterTheUndo, layerId)?.itemId,
    );
    expect(itemsBackOnAir, 'every layer "Limpar tudo" emptied must be back').toEqual([
      'item-relogio-enduro',
      anaSouzaItemId,
      'item-aviso-melhor-volta',
    ]);
  });

  it('undoes only the newest change when the layers changed at different moments', () => {
    // Arrange: the clock taken, then Ana Souza taken.
    const slicesWithBoth = applyCommandsOneAfterTheOther(buildRaceDayWithTheFourButtons(), [
      { type: 'takeItem', itemId: 'item-relogio-enduro' },
      { type: 'takeItem', itemId: anaSouzaItemId },
    ]);

    // Act: press "Desfazer última".
    const slicesAfterTheUndo = applyCommandsOneAfterTheOther(
      slicesWithBoth,
      [{ type: 'undoLastChangeOnProgram' }],
      3,
    );

    // Assert: Ana Souza is gone (the newest change), the clock stays.
    expect(
      readWhatProgramShowsOnLayer(slicesAfterTheUndo, 'lower-third'),
      'the newest change, the take of Ana Souza, must be the one undone',
    ).toBeUndefined();
    expect(
      readWhatProgramShowsOnLayer(slicesAfterTheUndo, 'clock')?.itemId,
      'an older change on another layer must stay as it is',
    ).toBe('item-relogio-enduro');
  });
});

describe('the refusals of an undo', () => {
  it('refuses to bring back an item deleted since, and changes nothing', () => {
    // Arrange: Ana Souza replaced by Bruno Lima, and then her item deleted.
    const slicesWithoutHerItem = applyCommandsOneAfterTheOther(buildRaceDayWithTheFourButtons(), [
      { type: 'takeItem', itemId: anaSouzaItemId },
      { type: 'takeItem', itemId: brunoLimaItemId },
      { type: 'deleteItem', itemId: anaSouzaItemId },
    ]);

    // Act: press "Desfazer" on the "Tarja" row.
    const outcome = reduceCommand(
      slicesWithoutHerItem,
      { type: 'undoOnLayer', layerId: 'lower-third' },
      buildContextOfCommandNumber(4),
    );

    // Assert: refused in pt-BR, naming the item.
    expect(outcome, 'an item deleted since cannot come back').toEqual({
      status: 'refused',
      error: {
        code: 'ITEM_NOT_FOUND',
        message:
          'Não dá para desfazer: o item "Tarja – Ana Souza", que estava na camada antes, foi excluído.',
      },
    });
  });

  it('refuses to bring back an item whose graphic is no longer listed', () => {
    // Arrange: Ana Souza replaced by Bruno Lima; then the lower third's graphic is gone
    // from the build (its folder was removed before a restart).
    const slicesWithBrunoLima = applyCommandsOneAfterTheOther(buildRaceDayWithTheFourButtons(), [
      { type: 'takeItem', itemId: anaSouzaItemId },
      { type: 'takeItem', itemId: brunoLimaItemId },
    ]);
    const slicesWithoutTheGraphic = {
      ...slicesWithBrunoLima,
      graphics: slicesWithBrunoLima.graphics.filter((graphic) => graphic.id !== 'team-lower-third'),
    };

    // Act: press "Desfazer" on the "Tarja" row.
    const outcome = reduceCommand(
      slicesWithoutTheGraphic,
      { type: 'undoOnLayer', layerId: 'lower-third' },
      buildContextOfCommandNumber(3),
    );

    // Assert: refused in pt-BR, naming the item and its graphic.
    expect(outcome, 'an item whose graphic is gone cannot come back').toEqual({
      status: 'refused',
      error: {
        code: 'GRAPHIC_NOT_FOUND',
        message:
          'Não dá para desfazer: o gráfico "team-lower-third" do item "Tarja – Ana Souza" não está mais registrado.',
      },
    });
  });

  it('refuses an undo on a layer with nothing to undo', () => {
    // Arrange: a race day where nothing was ever taken.
    const raceDay = buildRaceDayWithTheFourButtons();

    // Act: press "Desfazer" on the "Tarja" row.
    const outcome = reduceCommand(
      raceDay,
      { type: 'undoOnLayer', layerId: 'lower-third' },
      buildContextOfCommandNumber(1),
    );

    // Assert: refused in pt-BR, naming the layer.
    expect(outcome, 'a layer with no change remembered has nothing to undo').toEqual({
      status: 'refused',
      error: {
        code: 'NOTHING_TO_UNDO',
        message: 'A camada "Tarja" não tem nada para desfazer.',
      },
    });
  });

  it('refuses "Desfazer última" when no layer has anything to undo', () => {
    // Arrange: a race day where nothing was ever taken.
    const raceDay = buildRaceDayWithTheFourButtons();

    // Act: press "Desfazer última".
    const outcome = reduceCommand(
      raceDay,
      { type: 'undoLastChangeOnProgram' },
      buildContextOfCommandNumber(1),
    );

    // Assert: refused in pt-BR.
    expect(outcome, 'with no change remembered anywhere there is nothing to undo').toEqual({
      status: 'refused',
      error: { code: 'NOTHING_TO_UNDO', message: 'Não há nada no ar para desfazer.' },
    });
  });

  it('refuses all of "Desfazer última" when one of its layers cannot come back', () => {
    // Arrange: the clock and Ana Souza on air, "Limpar tudo", then her item deleted.
    const slicesWithoutHerItem = applyCommandsOneAfterTheOther(buildRaceDayWithTheFourButtons(), [
      { type: 'takeItem', itemId: 'item-relogio-enduro' },
      { type: 'takeItem', itemId: anaSouzaItemId },
      { type: 'clearAll' },
      { type: 'deleteItem', itemId: anaSouzaItemId },
    ]);

    // Act: press "Desfazer última".
    const outcome = reduceCommand(
      slicesWithoutHerItem,
      { type: 'undoLastChangeOnProgram' },
      buildContextOfCommandNumber(5),
    );

    // Assert: refused for her item, and the clock did not come back alone either.
    expect(outcome.status, 'half a "Limpar tudo" must not come back').toBe('refused');
  });
});

/**
 * "Desfazer" on one layer, as the operator meets it (apps/server)
 *
 * What this module is for:
 *   A wrong take, or a wrong "Limpar", must be put right with one press (concept §7 rule
 *   5, BAJAOVRLAY-30). After every command that changes what a layer's program output
 *   shows, the server remembers what it showed before (programHistory, ten changes per
 *   layer); undoOnLayer ("Desfazer" on a Camadas row) puts back what one layer showed
 *   before its last change and forgets that change.
 *
 * What these tests prove (through reduceCommand, the pure step every command takes):
 *   - A wrong lower third taken over the right one: "Desfazer" brings the right one back.
 *   - A "Limpar" by mistake, and an auto-out: "Desfazer" brings back what they took off.
 *   - A take on an empty layer is undone by emptying it again.
 *   - An undo is not remembered itself: a second press goes one change further back.
 *   - Each layer remembers its last ten changes only.
 *   - A PiP layer is undone like any other.
 *
 * What these tests deliberately do not cover:
 *   - What comes back field by field, and what is not a change; whatAnUndoBringsBack.test.ts.
 *   - "Desfazer última" and the refusals; undoLastChangeOnProgram.test.ts.
 *   - The history across a restart and the one broadcast of an undo; the store test
 *     storeProgramHistory.test.ts, with a real SQLite file.
 */
import { describe, expect, it } from 'vitest';

import {
  applyCommandsOneAfterTheOther,
  buildAnaSouzaLowerThirdItem,
  buildBrunoLimaLowerThirdItem,
  buildPitCameraLayer,
  buildRaceDayWithTheFourButtons,
  countChangesRememberedOnLayer,
  readWhatProgramShowsOnLayer,
} from './programHistorySlices.testSupport.js';

const anaSouzaItemId = buildAnaSouzaLowerThirdItem().id;
const brunoLimaItemId = buildBrunoLimaLowerThirdItem().id;

describe('undoOnLayer, "Desfazer" on a Camadas row', () => {
  it('brings back the right lower third after the wrong one was taken over it', () => {
    // Arrange: "Tarja – Ana Souza" on air, then "Tarja – Bruno Lima" taken over it by mistake.
    const slicesWithTheWrongOne = applyCommandsOneAfterTheOther(buildRaceDayWithTheFourButtons(), [
      { type: 'takeItem', itemId: anaSouzaItemId },
      { type: 'takeItem', itemId: brunoLimaItemId },
    ]);

    // Act: press "Desfazer" on the "Tarja" row.
    const slicesAfterTheUndo = applyCommandsOneAfterTheOther(
      slicesWithTheWrongOne,
      [{ type: 'undoOnLayer', layerId: 'lower-third' }],
      3,
    );

    // Assert: Ana Souza is back on air, with her name and role as they were.
    expect(
      readWhatProgramShowsOnLayer(slicesAfterTheUndo, 'lower-third'),
      'the lower third that was on air before the mistake must be back',
    ).toEqual({
      itemId: anaSouzaItemId,
      resolvedData: { personName: 'Ana Souza', personRole: 'Piloto · Baja UFPR, carro 42' },
    });
    expect(
      countChangesRememberedOnLayer(slicesAfterTheUndo, 'lower-third'),
      'the undone change is forgotten; only "empty before Ana Souza" is left',
    ).toBe(1);
  });

  it('brings back what a "Limpar" by mistake took off', () => {
    // Arrange: Ana Souza on air, and then "Limpar" pressed on her layer.
    const slicesAfterTheClear = applyCommandsOneAfterTheOther(buildRaceDayWithTheFourButtons(), [
      { type: 'takeItem', itemId: anaSouzaItemId },
      { type: 'clearLayer', layerId: 'lower-third' },
    ]);

    // Act: press "Desfazer" on the "Tarja" row.
    const slicesAfterTheUndo = applyCommandsOneAfterTheOther(
      slicesAfterTheClear,
      [{ type: 'undoOnLayer', layerId: 'lower-third' }],
      3,
    );

    // Assert: she is back on air.
    expect(
      readWhatProgramShowsOnLayer(slicesAfterTheUndo, 'lower-third')?.itemId,
      'the lower third the clear took off must be back on air',
    ).toBe(anaSouzaItemId);
  });

  it('brings back the notice an auto-out took off', () => {
    // Arrange: the fastest-lap notice taken, then cleared by the server's auto-out (which
    // clears the program output only).
    const slicesAfterTheAutoOut = applyCommandsOneAfterTheOther(buildRaceDayWithTheFourButtons(), [
      { type: 'takeItem', itemId: 'item-aviso-melhor-volta' },
      { type: 'clearLayer', layerId: 'notice', target: 'program' },
    ]);

    // Act: press "Desfazer" on the "Aviso" row.
    const slicesAfterTheUndo = applyCommandsOneAfterTheOther(
      slicesAfterTheAutoOut,
      [{ type: 'undoOnLayer', layerId: 'notice' }],
      3,
    );

    // Assert: the notice is back on air.
    expect(
      readWhatProgramShowsOnLayer(slicesAfterTheUndo, 'notice')?.itemId,
      'the notice the auto-out took off must be back on air',
    ).toBe('item-aviso-melhor-volta');
  });

  it('clears the layer when it showed nothing before its last take', () => {
    // Arrange: Ana Souza taken on an empty layer.
    const slicesWithAnaSouza = applyCommandsOneAfterTheOther(buildRaceDayWithTheFourButtons(), [
      { type: 'takeItem', itemId: anaSouzaItemId },
    ]);

    // Act: press "Desfazer" on the "Tarja" row.
    const slicesAfterTheUndo = applyCommandsOneAfterTheOther(
      slicesWithAnaSouza,
      [{ type: 'undoOnLayer', layerId: 'lower-third' }],
      2,
    );

    // Assert: the layer is empty again, and has nothing more to undo.
    expect(
      readWhatProgramShowsOnLayer(slicesAfterTheUndo, 'lower-third'),
      '"vazio" before the take means the undo clears the layer',
    ).toBeUndefined();
    expect(
      countChangesRememberedOnLayer(slicesAfterTheUndo, 'lower-third'),
      'the layer has nothing more to undo',
    ).toBe(0);
  });

  it('goes one change further back on a second press, since an undo is not remembered', () => {
    // Arrange: Ana Souza, then Bruno Lima, then "Limpar" on the layer.
    const slicesAfterThreeChanges = applyCommandsOneAfterTheOther(
      buildRaceDayWithTheFourButtons(),
      [
        { type: 'takeItem', itemId: anaSouzaItemId },
        { type: 'takeItem', itemId: brunoLimaItemId },
        { type: 'clearLayer', layerId: 'lower-third' },
      ],
    );

    // Act: press "Desfazer" twice on the "Tarja" row.
    const slicesAfterTwoUndos = applyCommandsOneAfterTheOther(
      slicesAfterThreeChanges,
      [
        { type: 'undoOnLayer', layerId: 'lower-third' },
        { type: 'undoOnLayer', layerId: 'lower-third' },
      ],
      4,
    );

    // Assert: the first press brought Bruno Lima back, the second Ana Souza; no redo.
    expect(
      readWhatProgramShowsOnLayer(slicesAfterTwoUndos, 'lower-third')?.itemId,
      'two presses must go two changes back, not undo the first undo',
    ).toBe(anaSouzaItemId);
  });

  it('remembers the last ten changes of a layer only', () => {
    // Arrange: twelve takes on the "Tarja" layer, Ana Souza and Bruno Lima in turn.
    const twelveTakes = Array.from({ length: 12 }, (_unused, index) => ({
      type: 'takeItem' as const,
      itemId: index % 2 === 0 ? anaSouzaItemId : brunoLimaItemId,
    }));

    // Act: run them.
    const slicesAfterTwelveTakes = applyCommandsOneAfterTheOther(
      buildRaceDayWithTheFourButtons(),
      twelveTakes,
    );

    // Assert: ten changes remembered; the oldest two ("vazio" and the first Ana Souza) gone.
    const lowerThirdHistory = slicesAfterTwelveTakes.programHistory.find(
      (layerHistory) => layerHistory.layerId === 'lower-third',
    );
    expect(lowerThirdHistory?.entries.length, 'a layer remembers ten changes at most').toBe(10);
    expect(
      lowerThirdHistory?.entries[0]?.shownBefore,
      'the oldest change kept is what the third take replaced: the second take, Bruno Lima',
    ).toMatchObject({ kind: 'item', itemId: brunoLimaItemId });
  });

  it('undoes a layer of the PiP output like a layer of program', () => {
    // Arrange: a "PiP" output with its "Câmera do box" layer, and Ana Souza's lower third
    // moved there; then Bruno Lima's moved there too and taken over hers.
    const raceDay = buildRaceDayWithTheFourButtons();
    const raceDayWithAPip = {
      ...raceDay,
      outputs: [...raceDay.outputs, { outputId: 'pip', name: 'PiP', order: 1 }],
      layers: [...raceDay.layers, buildPitCameraLayer()],
      items: raceDay.items.map((item) => ({ ...item, layerId: 'camera-do-box' })),
    };
    const slicesWithTheWrongOne = applyCommandsOneAfterTheOther(raceDayWithAPip, [
      { type: 'takeItem', itemId: anaSouzaItemId },
      { type: 'takeItem', itemId: brunoLimaItemId },
    ]);

    // Act: press "Desfazer" on the "Câmera do box" row.
    const slicesAfterTheUndo = applyCommandsOneAfterTheOther(
      slicesWithTheWrongOne,
      [{ type: 'undoOnLayer', layerId: 'camera-do-box' }],
      3,
    );

    // Assert: Ana Souza is back on the PiP's layer.
    expect(
      readWhatProgramShowsOnLayer(slicesAfterTheUndo, 'camera-do-box')?.itemId,
      'an undo on a layer of the PiP output must bring back what it showed',
    ).toBe(anaSouzaItemId);
  });
});

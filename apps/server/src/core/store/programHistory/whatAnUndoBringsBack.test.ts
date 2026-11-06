/**
 * What an undo brings back, and what is not a change to undo (apps/server)
 *
 * What this module is for:
 *   An undo puts back what a layer showed (BAJAOVRLAY-30): the item is taken again through
 *   the same path as a take, so a field bound to a source reads the source now, while what
 *   the operator typed comes back as the viewers saw it. And only a change of what program
 *   shows is remembered: a preview or an edit on air keeps the same instance on air.
 *
 * What these tests prove (through reduceCommand, the pure step every command takes):
 *   - A field bound to a source reads the source now; a field changed on air comes back as
 *     it was on air, with its "alterado no ar" mark.
 *   - A typed field comes back as it was on air, even after the item was edited since.
 *   - A preview and an edit on air are not changes of program to undo.
 *
 * What these tests deliberately do not cover:
 *   - Which press undoes what; undoOnLayer.test.ts and undoLastChangeOnProgram.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  buildEnduroClockItemBoundToTheSimulator,
  buildRaceDaySlicesWithTheSimulator,
  readSimulatorSnapshotAtLap34,
} from '../reducers/boundItemSlices.testSupport.js';
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

describe('what an undo brings back', () => {
  it('reads a bound field from its source now, and brings typed fields back as they were', () => {
    // Arrange: the enduro clock bound to the simulator (flag green at the take), the typed
    // title changed on air to "Enduro – Final", then "Limpar"; then the simulator turns yellow.
    const boundClockItem = buildEnduroClockItemBoundToTheSimulator(0);
    const raceDay = buildRaceDaySlicesWithTheSimulator({
      items: [boundClockItem],
      dataSnapshots: [readSimulatorSnapshotAtLap34('session.enduro-green.json')],
    });
    const slicesAfterTheClear = applyCommandsOneAfterTheOther(raceDay, [
      { type: 'takeItem', itemId: boundClockItem.id },
      {
        type: 'updateInstanceData',
        instanceId: 'instancia-1',
        data: { sessionName: 'Enduro – Final' },
      },
      { type: 'clearLayer', layerId: 'clock' },
    ]);
    const slicesUnderYellow = {
      ...slicesAfterTheClear,
      dataSnapshots: [readSimulatorSnapshotAtLap34('session.enduro-yellow.json')],
    };

    // Act: press "Desfazer" on the "Relógio" row.
    const slicesAfterTheUndo = applyCommandsOneAfterTheOther(
      slicesUnderYellow,
      [{ type: 'undoOnLayer', layerId: 'clock' }],
      4,
    );

    // Assert: the flag reads the source now (yellow); the title is the one typed on air,
    // still marked "alterado no ar".
    const clockOnAir = slicesAfterTheUndo.instances.find(
      (instance) => instance.layerId === 'clock' && instance.target === 'program',
    );
    expect(clockOnAir?.resolvedData.state, 'a bound field must read its source now').toBe('yellow');
    expect(
      clockOnAir?.resolvedData.sessionName,
      'a field changed on air must come back as it was on air',
    ).toBe('Enduro – Final');
    expect(
      clockOnAir?.fieldsChangedOnAir,
      'the "alterado no ar" chip must come back with the value',
    ).toEqual(['sessionName']);
  });

  it('brings a typed field back as it was on air, even after the item was edited since', () => {
    // Arrange: Ana Souza taken and then replaced by Bruno Lima; then her item's role edited.
    const slicesWithBrunoLima = applyCommandsOneAfterTheOther(buildRaceDayWithTheFourButtons(), [
      { type: 'takeItem', itemId: anaSouzaItemId },
      { type: 'takeItem', itemId: brunoLimaItemId },
      {
        type: 'updateItemFields',
        itemId: anaSouzaItemId,
        fields: { personRole: { kind: 'literal', value: 'Chefe de equipe · Baja UFPR' } },
      },
    ]);

    // Act: press "Desfazer" on the "Tarja" row.
    const slicesAfterTheUndo = applyCommandsOneAfterTheOther(
      slicesWithBrunoLima,
      [{ type: 'undoOnLayer', layerId: 'lower-third' }],
      4,
    );

    // Assert: the role is the one the viewers saw, not the edit made since.
    expect(
      readWhatProgramShowsOnLayer(slicesAfterTheUndo, 'lower-third')?.resolvedData.personRole,
      'an undo puts back what the layer showed, not what the item says now',
    ).toBe('Piloto · Baja UFPR, carro 42');
  });
});

describe('what is not a change of program', () => {
  it('remembers nothing for a preview or an edit on air', () => {
    // Arrange: Ana Souza on air (one change remembered).
    const slicesWithAnaSouza = applyCommandsOneAfterTheOther(buildRaceDayWithTheFourButtons(), [
      { type: 'takeItem', itemId: anaSouzaItemId },
    ]);

    // Act: preview Bruno Lima and edit Ana Souza's role on air.
    const slicesAfter = applyCommandsOneAfterTheOther(
      slicesWithAnaSouza,
      [
        { type: 'previewItem', itemId: brunoLimaItemId, origin: 'manual' },
        {
          type: 'updateInstanceData',
          instanceId: 'instancia-1',
          data: { personRole: 'Piloto · Baja UFPR' },
        },
      ],
      2,
    );

    // Assert: still one change remembered, the take.
    expect(
      countChangesRememberedOnLayer(slicesAfter, 'lower-third'),
      'a preview and an edit on air do not change what program shows on the layer',
    ).toBe(1);
  });
});

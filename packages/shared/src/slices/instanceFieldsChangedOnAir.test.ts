/**
 * An instance's item, and the fields changed on air since its take (packages/shared)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-37 everything on air or in preview comes from an item, and the
 *   instance says which one in `itemId`. When the operator changes such an instance with
 *   "Atualizar" in "Edição rápida", the server lists in `fieldsChangedOnAir` the top-level
 *   fields that now differ from what the item gives. Camadas shows the chip "alterado no
 *   ar" for that list, and "Salvar no item" writes those fields back into the item.
 *
 * What these tests prove:
 *   - An instance of an item carrying the list is accepted unchanged.
 *   - An instance without the list is accepted and gets none invented: that is a fresh
 *     take (nothing changed yet) and every instance written before the list existed.
 *   - An instance with no `itemId` at all is still accepted: one put on air by hand
 *     before BAJAOVRLAY-37 may sit in the database, and the boot must keep it on air.
 *   - A list holding an empty key, or a single text instead of a list, is refused.
 *
 * What these tests deliberately do not cover:
 *   - Who writes the list and when it is emptied; the updateInstanceData and
 *     saveOnAirChangesIntoItem reducer tests in apps/server do.
 *   - That no new instance is ever made without an item; the server's take step is the
 *     only maker of instances, and its tests prove it.
 */
import { describe, expect, it } from 'vitest';

import { InstanceSchema } from './instance.js';

/** Builds the session title lower third of item "Abertura do enduro", on air on program. */
function buildOpeningLowerThirdOnProgram() {
  return {
    id: '3f9b2d71-8c4e-4a06-b5d2-7e1a0c9f8b34',
    layerId: 'lower-third',
    graphicId: 'session-title',
    target: 'program',
    resolvedData: { title: 'Enduro de Resistência', subtitle: 'Baja SAE Brasil 2026' },
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-09T14:00:00.000Z',
    itemId: 'item-abertura-do-enduro',
  };
}

describe('InstanceSchema and fieldsChangedOnAir', () => {
  it('accepts an instance of an item whose title was changed on air', () => {
    // Arrange: the opening lower third after the operator retyped its title on air.
    const lowerThirdWithChangedTitle = {
      ...buildOpeningLowerThirdOnProgram(),
      resolvedData: { title: 'Enduro — 2ª hora', subtitle: 'Baja SAE Brasil 2026' },
      fieldsChangedOnAir: ['title'],
    };

    // Act: check the instance.
    const result = InstanceSchema.safeParse(lowerThirdWithChangedTitle);

    // Assert: it is accepted unchanged, the list included.
    expect(result.success, 'an instance with its list of changed fields must pass').toBe(true);
    expect(result.data, 'validation must not drop the list of changed fields').toEqual(
      lowerThirdWithChangedTitle,
    );
  });

  it('accepts an instance without the list, and invents none, as a fresh take is', () => {
    // Arrange: the opening lower third as the take left it, nothing changed on air.
    const lowerThirdAsTaken = buildOpeningLowerThirdOnProgram();

    // Act: check the instance.
    const result = InstanceSchema.safeParse(lowerThirdAsTaken);

    // Assert: it is accepted and no list is added: no list means nothing changed.
    expect(result.success, 'the list of changed fields must be optional').toBe(true);
    expect(result.data, 'no list may be added to an instance that had none').toEqual(
      lowerThirdAsTaken,
    );
  });

  it('still accepts an instance with no item, as one taken by hand before BAJAOVRLAY-37', () => {
    // Arrange: a lower third put on air from "Edição rápida" before items were required,
    // as the database may still hold it after the upgrade.
    const lowerThirdTakenByHand: Record<string, unknown> = buildOpeningLowerThirdOnProgram();
    delete lowerThirdTakenByHand.itemId;

    // Act: check the instance.
    const result = InstanceSchema.safeParse(lowerThirdTakenByHand);

    // Assert: it is accepted, so the boot keeps it on air ("sem item" in Camadas).
    expect(result.success, 'an instance made before items were required must still pass').toBe(
      true,
    );
    expect(result.data, 'no item id may be invented for it').toEqual(lowerThirdTakenByHand);
  });

  const refusedListScenarios = [
    // An empty key names no field, so "Salvar no item" could not write anything with it.
    { name: 'refuses a list that holds an empty key', fieldsChangedOnAir: [''] },
    // One text instead of a list is a server bug that must not be stored.
    { name: 'refuses a single text in place of the list', fieldsChangedOnAir: 'title' },
  ];

  it.each(refusedListScenarios)('$name', ({ fieldsChangedOnAir }) => {
    // Arrange: the opening lower third with the broken list of this row.
    const lowerThirdWithBrokenList = { ...buildOpeningLowerThirdOnProgram(), fieldsChangedOnAir };

    // Act: check the instance.
    const result = InstanceSchema.safeParse(lowerThirdWithBrokenList);

    // Assert: it is refused.
    expect(result.success, 'a broken list of changed fields must be refused').toBe(false);
  });
});

// The page the "item mudou" tests of Camadas draw: the interview lower third and the
// endurance start clock on air, as their takes put them there, and their items as saved
// since. Used by LayerStatusPanelItemAheadOfTheAir*.test.tsx.
import type { Instance, Item } from '@bajaovrlay/shared';
import { screen, within } from '@testing-library/react';

import {
  buildEnduranceStartClockItem,
  buildInstanceTakenFromItem,
  buildInterviewLowerThirdItem,
  buildSlicesWithTheRaceClockAndTheLowerThird,
} from '@/features/items/itemsLikeTheEditorSaves.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';

import { LayerStatusPanel } from './LayerStatusPanel';

export const idOfTheLowerThirdOnAir = 'd2a7f4c9-1e3b-4b58-9c06-8f5e2a1d7b43';
export const idOfTheLowerThirdInPreview = '6c1e8b3a-5d27-4f90-a4e6-1b9d0c7f2e58';
export const idOfTheClockOnAir = '9a4c1e7f-3b5d-4e20-8f6a-2c7b9d1e5f38';
const momentOfTheTake = '2026-10-10T13:00:00.000Z';

/** The interview item after the take: her full name and her new role saved into it. */
export function buildInterviewItemSavedAfterTheTake(): Item {
  const item = buildInterviewLowerThirdItem();
  return {
    ...item,
    fields: {
      ...item.fields,
      nome: { kind: 'literal', value: 'Ana Souza Lima' },
      cargo: { kind: 'literal', value: 'Piloto' },
    },
  };
}

/** The interview lower third on this output, as its take put it there (before the save). */
export function buildInterviewLowerThirdAsTaken(target: 'program' | 'preview'): Instance {
  return buildInstanceTakenFromItem({
    id: target === 'program' ? idOfTheLowerThirdOnAir : idOfTheLowerThirdInPreview,
    item: buildInterviewLowerThirdItem(),
    layerId: 'lower-third',
    target,
    takenAt: momentOfTheTake,
  });
}

/** The endurance start clock on air as its take put it there, from 240:00. */
export function buildEnduranceStartClockAsTaken(): Instance {
  const instance = buildInstanceTakenFromItem({
    id: idOfTheClockOnAir,
    item: buildEnduranceStartClockItem(),
    layerId: 'clock',
    target: 'program',
    takenAt: momentOfTheTake,
  });
  return {
    ...instance,
    resolvedData: { ...instance.resolvedData, referenceWallClockMs: Date.parse(momentOfTheTake) },
  };
}

/** Draws Camadas on a page holding these items and these instances. */
export function renderCamadasWith(items: Item[], instances: Instance[]) {
  return renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, {
    ...buildSlicesWithTheRaceClockAndTheLowerThird(),
    items,
    instances,
  });
}

/** The Camadas row of one layer. */
export function findLayerRow(layerName: string) {
  return within(screen.getByRole('listitem', { name: layerName }));
}

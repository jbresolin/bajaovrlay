import type { Instance } from '@bajaovrlay/shared';

/**
 * Finds the instance "Atualizar no ar" changes for an item: an instance the server made
 * by taking that item (it carries the item's id) on the program output, on whatever layer
 * it is. An instance on the preview output does not count, because nobody sees it.
 * Of several, the one taken most recently is the answer: it is the operator's last take.
 * Two taken at the very same moment give the later one in the slice, so the answer never
 * flips between them. Undefined means the item is not on air.
 */
export function findInstanceOfItemOnProgram(
  instances: Instance[],
  itemId: string,
): Instance | undefined {
  const instancesOfTheItemOnProgram = instances.filter(
    (instance) => instance.itemId === itemId && instance.target === 'program',
  );

  let instanceTakenMostRecently: Instance | undefined = undefined;
  for (const instanceOfTheItem of instancesOfTheItemOnProgram) {
    const wasTakenNoEarlierThanTheOneFound =
      instanceTakenMostRecently === undefined ||
      Date.parse(instanceOfTheItem.takenAt) >= Date.parse(instanceTakenMostRecently.takenAt);
    if (wasTakenNoEarlierThanTheOneFound) {
      instanceTakenMostRecently = instanceOfTheItem;
    }
  }
  return instanceTakenMostRecently;
}

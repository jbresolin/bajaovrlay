// Converting stored items from the shape before BAJAOVRLAY-16 (`rundownId`, or the
// planned `quickFirePanelId`) to the shape with `home`. Run at boot on the stored items
// row, before that row is checked against its schema.
//
// Why at load, before the schema check: the shared ItemSchema has one shape only, so
// clients never see the older one and no code but this file needs to know it existed.
// Converting after the check is impossible (the check refuses the older shape), and
// accepting both shapes in the schema would push the older one onto every client.
//
// What could go wrong: an item with neither field, or with both, is left as it is, so
// the schema check refuses it and the boot stops, as for any stored slice that fails its
// schema. That is on purpose: guessing a home would hide a damaged row.

/** The stored items after conversion, and how many of them were converted. */
export type ItemsConvertedToTheirHome = {
  storedItems: unknown;
  numberOfItemsConverted: number;
};

/**
 * Gives each stored item that has `rundownId` alone a rundown home, and each that has
 * `quickFirePanelId` alone a quick-fire home, taking the older field off. Everything
 * else (an item that already has a home, anything that is not an item) is handed back
 * as it was, for the schema check to judge. Pure: the stored value is not changed.
 */
export function convertStoredItemsToTheirHome(storedItems: unknown): ItemsConvertedToTheirHome {
  if (!Array.isArray(storedItems)) {
    return { storedItems, numberOfItemsConverted: 0 };
  }
  let numberOfItemsConverted = 0;
  const convertedItems = storedItems.map((storedItem: unknown) => {
    const convertedItem = convertOneStoredItem(storedItem);
    if (convertedItem !== storedItem) {
      numberOfItemsConverted += 1;
    }
    return convertedItem;
  });
  return { storedItems: convertedItems, numberOfItemsConverted };
}

/** Converts one stored item, or hands it back as the very same value when it cannot. */
function convertOneStoredItem(storedItem: unknown): unknown {
  const isObject = typeof storedItem === 'object' && storedItem !== null;
  if (!isObject || 'home' in storedItem) {
    return storedItem;
  }
  const hasRundownId = 'rundownId' in storedItem;
  const hasQuickFirePanelId = 'quickFirePanelId' in storedItem;
  if (hasRundownId && !hasQuickFirePanelId) {
    const { rundownId, ...restOfTheItem } = storedItem;
    return { ...restOfTheItem, home: { kind: 'rundown', rundownId } };
  }
  if (hasQuickFirePanelId && !hasRundownId) {
    const { quickFirePanelId, ...restOfTheItem } = storedItem;
    return { ...restOfTheItem, home: { kind: 'quickFire', panelId: quickFirePanelId } };
  }
  return storedItem;
}

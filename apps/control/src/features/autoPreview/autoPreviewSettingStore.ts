import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  readIsAutoPreviewOnFromBrowserStorage,
  writeIsAutoPreviewOnToBrowserStorage,
} from './autoPreviewSettingInBrowserStorage';

/**
 * "Prévia automática" as the page holds it: whether it is on, and the one way to change
 * it. Why it is kept in the browser and not on the server is written in
 * autoPreviewSettingInBrowserStorage.ts.
 */
export type AutoPreviewSetting = {
  isAutoPreviewOn: boolean;
  /** The operator flipped the switch: holds in the page at once and is stored in the browser. */
  chooseIsAutoPreviewOn: (isAutoPreviewOn: boolean) => void;
};

/** The store object: `getState()` to read, `subscribe()` to be told of changes. */
export type AutoPreviewSettingStore = StoreApi<AutoPreviewSetting>;

/**
 * Builds the page's one store for "Prévia automática", reading the browser's stored
 * choice now. The page builds exactly one when it opens (main.tsx), so the rundown column
 * and the "Prévia" monitor's "Tomar" read the same switch; each test builds its own.
 * It is kept apart from the server-state store on purpose: that one holds only what the
 * server sent (CLAUDE.md, architecture rule 1), and this is the page's one exception.
 * What could go wrong: another tab of the same browser does not follow a change until it
 * is reloaded, because the stored choice is read only here.
 */
export function createAutoPreviewSettingStore(): AutoPreviewSettingStore {
  return createStore<AutoPreviewSetting>()((set) => ({
    isAutoPreviewOn: readIsAutoPreviewOnFromBrowserStorage(),

    chooseIsAutoPreviewOn: (isAutoPreviewOn) => {
      set({ isAutoPreviewOn });
      writeIsAutoPreviewOnToBrowserStorage(isAutoPreviewOn);
    },
  }));
}

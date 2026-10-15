import { createContext, type ReactNode, useContext } from 'react';
import { useStore } from 'zustand';

import type { AutoPreviewSetting, AutoPreviewSettingStore } from './autoPreviewSettingStore';

const AutoPreviewSettingContext = createContext<AutoPreviewSettingStore | null>(null);

/**
 * Makes the page's one "Prévia automática" store available to every component below it.
 * main.tsx wraps the page in it once, beside ControlPageStateProvider; tests wrap a
 * component in it with a store of their own (controlPageOnFakeServer.testSupport.tsx).
 */
export function AutoPreviewSettingProvider(props: {
  autoPreviewSettingStore: AutoPreviewSettingStore;
  children: ReactNode;
}) {
  return (
    <AutoPreviewSettingContext.Provider value={props.autoPreviewSettingStore}>
      {props.children}
    </AutoPreviewSettingContext.Provider>
  );
}

/**
 * "Prévia automática" for the page that is open: whether it is on (the component redraws
 * when it changes) and the function the switch calls to change it.
 */
export function useAutoPreviewSetting(): AutoPreviewSetting {
  const autoPreviewSettingStore = useContext(AutoPreviewSettingContext);
  if (autoPreviewSettingStore === null) {
    throw new Error('This component must be drawn inside <AutoPreviewSettingProvider>.');
  }
  const isAutoPreviewOn = useStore(autoPreviewSettingStore, (setting) => setting.isAutoPreviewOn);
  const chooseIsAutoPreviewOn = useStore(
    autoPreviewSettingStore,
    (setting) => setting.chooseIsAutoPreviewOn,
  );
  return { isAutoPreviewOn, chooseIsAutoPreviewOn };
}

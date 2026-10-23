import { useState } from 'react';

import {
  readIsEventSoundOnFromBrowserStorage,
  writeIsEventSoundOnToBrowserStorage,
} from './eventSoundSettingInBrowserStorage';

/**
 * "Som de eventos" for this page: whether it is on, read from the browser once, and the
 * switch's way to change it, which stores the choice in the browser too. Held by the
 * quick-fire strip, which draws both the switch (in the "Eventos" tab) and the alert.
 */
export function useEventSoundSetting(): {
  isEventSoundOn: boolean;
  chooseIsEventSoundOn: (isEventSoundOn: boolean) => void;
} {
  const [isEventSoundOn, setIsEventSoundOn] = useState(readIsEventSoundOnFromBrowserStorage);
  function chooseIsEventSoundOn(isOn: boolean): void {
    setIsEventSoundOn(isOn);
    writeIsEventSoundOnToBrowserStorage(isOn);
  }
  return { isEventSoundOn, chooseIsEventSoundOn };
}

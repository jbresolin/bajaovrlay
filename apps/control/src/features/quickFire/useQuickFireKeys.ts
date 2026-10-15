import type { CommandInput } from '@bajaovrlay/shared';

import { keyboardMap } from '@/keyboard/keyboardMap';
import { type KeyPress, useKeyboardShortcut } from '@/keyboard/useKeyboardShortcut';
import {
  useIsConnectedToServer,
  useSendCommand,
  useServerState,
} from '@/state/ControlPageStateProvider';

import {
  chooseCommandForDigitKey,
  findTabForFunctionKey,
  type QuickFireTab,
} from './quickFireTabs';

/** What the keys need from the strip: its tabs, the one shown, and how to show another. */
export type QuickFireKeysParts = {
  tabs: QuickFireTab[];
  tabShown: QuickFireTab;
  chooseTab: (tab: QuickFireTab) => void;
  /** features/autoPreview/useTakeThenPreviewNextItem.ts, the page's one take path. */
  sendTakeByThisOperator: (takeCommand: CommandInput) => void;
};

/**
 * The strip's keys. 1 to 9 fire the buttons of the tab shown (quickFireTabs.ts decides
 * which command): a panel's take goes through the page's one take path, like a click, and
 * a macro's run is sent as it is. F1 to F4 show the first four tabs. Which keys, and the
 * rules on where they are left alone, come from src/keyboard/keyboardMap.ts
 * (fireQuickFireButton, switchQuickFireTab); like every shortcut they are off while the
 * page is disconnected.
 * What could go wrong: a digit fires whatever is in that place NOW, so a button moved by
 * another operator a moment ago fires in its new place; the digit is drawn on each button
 * so the operator sees the same.
 */
export function useQuickFireKeys(parts: QuickFireKeysParts): void {
  const { tabs, tabShown, chooseTab, sendTakeByThisOperator } = parts;
  const items = useServerState((state) => state.items);
  const macros = useServerState((state) => state.macros);
  const sendCommand = useSendCommand();
  const isConnected = useIsConnectedToServer();

  function fireTheButtonOfTheDigit(keyPress: KeyPress): void {
    const command = chooseCommandForDigitKey({ tabShown, digit: keyPress.key, items, macros });
    if (command === null) {
      return;
    }
    if (command.type === 'takeItem') {
      sendTakeByThisOperator(command);
      return;
    }
    void sendCommand(command);
  }

  function showTheTabOfTheFunctionKey(keyPress: KeyPress): void {
    const tab = findTabForFunctionKey(tabs, keyPress.key);
    if (tab !== undefined) {
      chooseTab(tab);
    }
  }

  const shortcutOptions = { isEnabled: isConnected };
  useKeyboardShortcut(keyboardMap.fireQuickFireButton, fireTheButtonOfTheDigit, shortcutOptions);
  useKeyboardShortcut(keyboardMap.switchQuickFireTab, showTheTabOfTheFunctionKey, shortcutOptions);
}

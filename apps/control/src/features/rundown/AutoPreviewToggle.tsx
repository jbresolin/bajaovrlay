import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAutoPreviewSetting } from '@/features/autoPreview/AutoPreviewSettingProvider';
import { ptBR } from '@/i18n/ptBR';

// The id that ties the switch to its label.
const autoPreviewSwitchId = 'rundown-auto-preview';

/**
 * The switch "Prévia automática" at the top of the rundown. While it is on, the item the
 * cursor arrives on is also previewed: after a move by hand (useMoveCursorByHand.ts) and
 * after a take sent from this page, from the rundown or with "Tomar" under the "Prévia"
 * monitor (features/autoPreview/useTakeThenPreviewNextItem.ts). It reads and changes the
 * page's one store for the setting (features/autoPreview/), so a flip here changes what
 * "Tomar" in the centre column does too.
 * It is not an action button: it sends nothing to the server and works while the page is
 * disconnected, because the choice lives in this browser.
 *
 * After a click the switch lets go of the keyboard focus. On a switch the page leaves
 * Space, the arrows and Backspace to the switch (src/keyboard/useKeyboardShortcut.ts), so
 * a focus left here by the mouse would make the operator's keys do nothing until they
 * clicked somewhere else. What could go wrong: someone who reached the switch with the
 * Tab key and flipped it with Space loses their place and must Tab back from the top.
 */
export function AutoPreviewToggle() {
  const { isAutoPreviewOn, chooseIsAutoPreviewOn } = useAutoPreviewSetting();

  return (
    <div className="flex items-center gap-2">
      <Switch
        id={autoPreviewSwitchId}
        checked={isAutoPreviewOn}
        onCheckedChange={chooseIsAutoPreviewOn}
        onClick={(click) => click.currentTarget.blur()}
      />
      <Label htmlFor={autoPreviewSwitchId}>{ptBR.rundown.autoPreviewToggle}</Label>
    </div>
  );
}

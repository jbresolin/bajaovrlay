import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ptBR } from '@/i18n/ptBR';

// The id that ties the switch to its label.
const autoPreviewSwitchId = 'rundown-auto-preview';

/** What the switch needs: whether it is on, and what to call when the operator flips it. */
export type AutoPreviewToggleProps = {
  isAutoPreviewOn: boolean;
  onChosen: (isAutoPreviewOn: boolean) => void;
};

/**
 * The switch "Prévia automática" at the top of the rundown. While it is on, moving the
 * cursor by hand also previews the item the cursor lands on (useMoveCursorByHand.ts).
 * It is not an action button: it sends nothing to the server and works while the page is
 * disconnected, because the choice lives in this browser (autoPreviewSetting.ts).
 *
 * After a click the switch lets go of the keyboard focus. On a switch the page leaves
 * Space, the arrows and Backspace to the switch (src/keyboard/useKeyboardShortcut.ts), so
 * a focus left here by the mouse would make the operator's keys do nothing until they
 * clicked somewhere else. What could go wrong: someone who reached the switch with the
 * Tab key and flipped it with Space loses their place and must Tab back from the top.
 */
export function AutoPreviewToggle(props: AutoPreviewToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={autoPreviewSwitchId}
        checked={props.isAutoPreviewOn}
        onCheckedChange={props.onChosen}
        onClick={(click) => click.currentTarget.blur()}
      />
      <Label htmlFor={autoPreviewSwitchId}>{ptBR.rundown.autoPreviewToggle}</Label>
    </div>
  );
}

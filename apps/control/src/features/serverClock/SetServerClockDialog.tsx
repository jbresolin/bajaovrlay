import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import type { ServerClockSetting } from './useServerClockSetting';

const texts = ptBR.serverClock;

/**
 * The confirm of "Acertar relógio agora" (BAJAOVRLAY-62): it says what on air jumps (the
 * race clock and the countdowns on program and preview) and, when the header knows, by
 * how much; "Acertar agora" asks the server, and the dialog then says what it did.
 */
export function SetServerClockDialog(props: { serverClockSetting: ServerClockSetting }) {
  const serverClockSetting = props.serverClockSetting;
  const secondsOff = useServerState((state) => state.serverClockSecondsOffRealTime);

  return (
    <Dialog open={serverClockSetting.isOpen} onOpenChange={serverClockSetting.setIsOpen}>
      <DialogContent closeButtonLabel={texts.closeDialogButton} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{texts.confirmTitle}</DialogTitle>
          <DialogDescription>{texts.confirmWhatJumps}</DialogDescription>
        </DialogHeader>
        {secondsOff !== null && <p className="text-sm">{texts.confirmHowFar(secondsOff)}</p>}
        {serverClockSetting.isConfirming ? (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => serverClockSetting.setIsOpen(false)}
            >
              {texts.cancelButton}
            </Button>
            <Button type="button" onClick={() => void serverClockSetting.setTheClockNow()}>
              {texts.confirmButton}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p role="status" className="text-sm">
              {serverClockSetting.statusText}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => serverClockSetting.setIsOpen(false)}
            >
              {texts.closeButton}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

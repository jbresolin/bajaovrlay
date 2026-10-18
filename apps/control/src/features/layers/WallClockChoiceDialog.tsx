import type { WallClockFieldsChoice } from '@bajaovrlay/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ptBR } from '@/i18n/ptBR';

const texts = ptBR.layers.wallClockChoice;

/** What the question needs: whether it is open, and what each answer does. */
export type WallClockChoiceDialogProps = {
  isOpen: boolean;
  onChosen: (wallClockFields: WallClockFieldsChoice) => void;
  onCancelled: () => void;
};

/**
 * The question "Salvar no item" and "Salvar como item" ask before a clock's wall-clock
 * moment goes into an item (the choice carried over from PR #14): "Continuar este
 * relógio" stores the moment on air, so each take shows the same race time, which is
 * right for clearing a clock and bringing it back; "Começar na entrada no ar" stores the
 * moment of each take, which is right for a reusable item. Esc, the cross and "Cancelar"
 * save nothing.
 */
export function WallClockChoiceDialog(props: WallClockChoiceDialogProps) {
  return (
    <Dialog
      open={props.isOpen}
      onOpenChange={(isOpenNow) => {
        if (!isOpenNow) {
          props.onCancelled();
        }
      }}
    >
      <DialogContent closeButtonLabel={texts.closeDialogButton}>
        <DialogHeader>
          <DialogTitle>{texts.title}</DialogTitle>
          <DialogDescription>{texts.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => props.onChosen('keepMoment')}>
            {texts.keepMomentButton}
          </Button>
          <Button type="button" variant="secondary" onClick={() => props.onChosen('atTake')}>
            {texts.atTakeButton}
          </Button>
          <Button type="button" variant="outline" onClick={props.onCancelled}>
            {texts.cancelButton}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

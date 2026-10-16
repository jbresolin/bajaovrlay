import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ptBR } from '@/i18n/ptBR';
import { listKeyboardShortcutsInDialogOrder } from '@/keyboard/keyboardMap';

const texts = ptBR.keyboard;

/**
 * The "?" button of the page header and the dialog it opens: a table of every keyboard
 * shortcut (key, what it does, when it works), generated from src/keyboard/keyboardMap.ts,
 * so it lists exactly what the listeners do.
 *
 * Esc closes the dialog. Radix uses that press (it marks it as used before the page's
 * listeners hear it), so closing the dialog never arms "Limpar tudo"; the next Esc does.
 * The other shortcuts keep working while the dialog is open, as they do while any other
 * part of the page has the focus.
 */
export function KeyboardMapDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={texts.helpButtonLabel}
        onClick={() => setIsOpen(true)}
      >
        {texts.helpButton}
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent closeButtonLabel={texts.closeDialogButton} className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{texts.dialogTitle}</DialogTitle>
            <DialogDescription>{texts.dialogDescription}</DialogDescription>
          </DialogHeader>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">{texts.keyColumn}</th>
                <th className="py-2 pr-3 font-medium">{texts.descriptionColumn}</th>
                <th className="py-2 font-medium">{texts.conditionColumn}</th>
              </tr>
            </thead>
            <tbody>
              {listKeyboardShortcutsInDialogOrder().map((shortcut) => (
                <tr key={shortcut.keyName} className="border-b align-top last:border-b-0">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {shortcut.keyName}
                    </kbd>
                  </td>
                  <td className="py-2 pr-3">{shortcut.description}</td>
                  <td className="py-2 text-muted-foreground">{shortcut.condition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>
    </>
  );
}

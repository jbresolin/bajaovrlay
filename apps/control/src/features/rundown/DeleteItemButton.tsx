import { useEffect, useState } from 'react';

import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';

/** How long the button waits for the second press before going back to normal. */
export const deleteItemConfirmationWindowInMilliseconds = 3_000;

/** What the button needs: what to do once the delete was confirmed. */
export type DeleteItemButtonProps = {
  /** Called at the second press, the one that confirms. */
  onDeleteConfirmed: () => void;
  /**
   * The two texts, for a button that deletes something other than a rundown item (the
   * macro editor's "Excluir macro"). Left out: "Excluir" and "Confirmar: excluir".
   */
  texts?: { deleteButton: string; confirmButton: string };
};

/**
 * The "Excluir" button of one rundown row. Deleting an item cannot be undone, so one
 * stray click must not do it: the first press only arms the button, which then reads
 * "Confirmar: excluir", and a second press within 3 seconds deletes. It is the same
 * pattern as "Limpar tudo" (features/playout/ClearAllButton.tsx), repeated here on
 * purpose instead of shared: that one also listens to Esc, this one to no key at all.
 * Each row draws its own button, so arming one row never arms another. The macro editor
 * reuses it with its own two texts.
 * No browser `confirm()`: a dialog would freeze the page in the middle of a show.
 */
export function DeleteItemButton(props: DeleteItemButtonProps) {
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);

  // While armed, a timer disarms the button after 3 seconds. Pressing again (which
  // disarms it too) or the row leaving the page cancels the timer.
  useEffect(() => {
    if (!isAwaitingConfirmation) {
      return;
    }
    const disarmTimer = setTimeout(() => {
      setIsAwaitingConfirmation(false);
    }, deleteItemConfirmationWindowInMilliseconds);
    return () => {
      clearTimeout(disarmTimer);
    };
  }, [isAwaitingConfirmation]);

  function handlePress(): void {
    if (!isAwaitingConfirmation) {
      setIsAwaitingConfirmation(true);
      return;
    }
    setIsAwaitingConfirmation(false);
    props.onDeleteConfirmed();
  }

  const texts = props.texts ?? {
    deleteButton: ptBR.rundown.deleteItemButton,
    confirmButton: ptBR.rundown.deleteItemConfirmButton,
  };
  return (
    <ActionButton
      size="xs"
      variant={isAwaitingConfirmation ? 'destructive' : 'ghost'}
      onClick={handlePress}
    >
      {isAwaitingConfirmation ? texts.confirmButton : texts.deleteButton}
    </ActionButton>
  );
}

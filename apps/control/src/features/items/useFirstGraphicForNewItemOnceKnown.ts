import type { Graphic } from '@bajaovrlay/shared';
import { useEffect } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import type { ItemEditorFormValues } from './itemEditorForm';

/**
 * Chooses the first graphic the server has, on that graphic's default layer, for a new
 * item whose graphic is still to be chosen, once the list of graphics is known.
 *
 * When the page already knows the graphics (the usual case: "+ Item" pressed on a
 * connected page) that is the form's starting value, set where the form is made. This
 * is only for a list of graphics that arrives after the editor is drawn (the page opened
 * before the server answered). Both are needed: a value set from an effect in the very
 * draw that creates the form is not shown by the dropdown. It never overrides a graphic
 * that is already chosen (a prefill's, or the operator's), and does nothing for a stored
 * item.
 */
export function useFirstGraphicForNewItemOnceKnown(
  itemForm: UseFormReturn<ItemEditorFormValues>,
  graphics: Graphic[],
  isEditingStoredItem: boolean,
): void {
  const getItemFormValues = itemForm.getValues;
  const setItemFormValue = itemForm.setValue;
  useEffect(() => {
    const firstGraphic = graphics[0];
    const isGraphicStillToBeChosen = getItemFormValues('graphicId') === '';
    if (isEditingStoredItem || firstGraphic === undefined || !isGraphicStillToBeChosen) {
      return;
    }
    setItemFormValue('graphicId', firstGraphic.id);
    setItemFormValue('layerId', firstGraphic.defaultLayerId);
  }, [graphics, isEditingStoredItem, getItemFormValues, setItemFormValue]);
}

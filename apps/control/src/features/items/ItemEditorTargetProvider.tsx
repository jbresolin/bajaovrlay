import type { Command, ItemFields, ItemHome } from '@bajaovrlay/shared';
import { createContext, type ReactNode, useContext, useState } from 'react';

/**
 * What a new item can be opened with already filled ("Salvar como item" on a Camadas row
 * holding an instance with no item): its graphic, its layer, and the graphic's fields,
 * each in the kind it is to be stored in (literal or takeTime). The label and "Onde" are
 * left to the operator.
 */
export type ItemEditorPrefill = {
  graphicId: string;
  layerId: string;
  fields: ItemFields;
};

/**
 * One opening of the editor with a prefill. `openingNumber` grows at every such opening,
 * so the editor can tell a second "Salvar como item" from the first and start a fresh
 * form even when the prefill and the home are the same.
 */
export type PrefilledOpening = {
  prefill: ItemEditorPrefill;
  openingNumber: number;
};

/**
 * What the page's one item editor is open for, if at all: nothing, a new item (where it
 * goes unless the operator picks another place in "Onde", and the prefill it was opened
 * with, if any), or a stored item. It is about the page (which box is open), not about
 * the show, so it is the page's own state and never the server's.
 */
export type ItemEditorTarget =
  | { kind: 'closed' }
  | { kind: 'newItem'; home: ItemHome; prefilledOpening: PrefilledOpening | null }
  | {
      kind: 'existingItem';
      itemId: string;
      /**
       * The command types whose refusal the editor shows from the start: the take (or
       * preview) of "Salvar e disparar" refused right after a new item was saved, which
       * reopens the editor on the item just saved. Empty for every other opening.
       */
      refusalsToShowAtOpening: Command['type'][];
    };

/** The editor's target and the four ways to change it. */
export type ItemEditorTargetOnPage = {
  itemEditorTarget: ItemEditorTarget;
  /** Opens the editor for a new item going to `home`, filled from `prefill` when given. */
  openItemEditorForNewItem: (home: ItemHome, prefill?: ItemEditorPrefill) => void;
  /**
   * Opens the editor on a stored item; `refusalsToShowAtOpening` names the commands whose
   * refusal it shows from the start (left out: none).
   */
  openItemEditorForItem: (itemId: string, refusalsToShowAtOpening?: Command['type'][]) => void;
  closeItemEditor: () => void;
};

const ItemEditorTargetContext = createContext<ItemEditorTargetOnPage | null>(null);

/**
 * Holds what the item editor is open for, for the whole page. The editor is drawn in the
 * rundown column, but the quick-fire strip on the right opens it too ("+ Atalho" and a
 * button's "Editar"), and so do "Edição rápida" ("Novo gráfico…") and the Camadas rows
 * ("Salvar como item"), so the choice cannot live in any of them alone. main.tsx wraps
 * the page in it once; tests do it through controlPageOnFakeServer.testSupport.tsx.
 */
export function ItemEditorTargetProvider(props: { children: ReactNode }) {
  const [itemEditorTarget, setItemEditorTarget] = useState<ItemEditorTarget>({ kind: 'closed' });
  const [numberOfPrefilledOpenings, setNumberOfPrefilledOpenings] = useState(0);

  function openItemEditorForNewItem(home: ItemHome, prefill?: ItemEditorPrefill): void {
    if (prefill === undefined) {
      setItemEditorTarget({ kind: 'newItem', home, prefilledOpening: null });
      return;
    }
    const openingNumber = numberOfPrefilledOpenings + 1;
    setNumberOfPrefilledOpenings(openingNumber);
    setItemEditorTarget({ kind: 'newItem', home, prefilledOpening: { prefill, openingNumber } });
  }

  const itemEditorTargetOnPage: ItemEditorTargetOnPage = {
    itemEditorTarget,
    openItemEditorForNewItem,
    openItemEditorForItem: (itemId, refusalsToShowAtOpening = []) =>
      setItemEditorTarget({ kind: 'existingItem', itemId, refusalsToShowAtOpening }),
    closeItemEditor: () => setItemEditorTarget({ kind: 'closed' }),
  };
  return (
    <ItemEditorTargetContext.Provider value={itemEditorTargetOnPage}>
      {props.children}
    </ItemEditorTargetContext.Provider>
  );
}

/** What the page's item editor is open for, and the functions that open and close it. */
export function useItemEditorTarget(): ItemEditorTargetOnPage {
  const itemEditorTargetOnPage = useContext(ItemEditorTargetContext);
  if (itemEditorTargetOnPage === null) {
    throw new Error('This component must be drawn inside <ItemEditorTargetProvider>.');
  }
  return itemEditorTargetOnPage;
}

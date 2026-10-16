import type { ItemHome } from '@bajaovrlay/shared';
import { createContext, type ReactNode, useContext, useState } from 'react';

/**
 * What the page's one item editor is open for, if at all: nothing, a new item (and
 * where it goes unless the operator picks another place in "Onde"), or a stored item.
 * It is about the page (which box is open), not about the show, so it is the page's own
 * state and never the server's.
 */
export type ItemEditorTarget =
  | { kind: 'closed' }
  | { kind: 'newItem'; home: ItemHome }
  | { kind: 'existingItem'; itemId: string };

/** The editor's target and the four ways to change it. */
export type ItemEditorTargetOnPage = {
  itemEditorTarget: ItemEditorTarget;
  openItemEditorForNewItem: (home: ItemHome) => void;
  openItemEditorForItem: (itemId: string) => void;
  closeItemEditor: () => void;
};

const ItemEditorTargetContext = createContext<ItemEditorTargetOnPage | null>(null);

/**
 * Holds what the item editor is open for, for the whole page. The editor is drawn in the
 * rundown column, but the quick-fire strip on the right opens it too ("+ Atalho" and a
 * button's "Editar"), so the choice cannot live in either of them alone. main.tsx wraps
 * the page in it once; tests do it through controlPageOnFakeServer.testSupport.tsx.
 */
export function ItemEditorTargetProvider(props: { children: ReactNode }) {
  const [itemEditorTarget, setItemEditorTarget] = useState<ItemEditorTarget>({ kind: 'closed' });

  const itemEditorTargetOnPage: ItemEditorTargetOnPage = {
    itemEditorTarget,
    openItemEditorForNewItem: (home) => setItemEditorTarget({ kind: 'newItem', home }),
    openItemEditorForItem: (itemId) => setItemEditorTarget({ kind: 'existingItem', itemId }),
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

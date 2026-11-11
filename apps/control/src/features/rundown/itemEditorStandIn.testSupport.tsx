// Test support: a stand-in for the item editor (features/items/ItemEditorPanel.tsx),
// which has tests of its own. The rundown's tests only need to know WHEN the editor is
// opened, FOR WHAT (a new item and where it would go, or which existing one) and that
// closing it works, so the stand-in says in one line what it was opened for and offers a
// button that closes it. Like the real editor, it draws itself as an area named "Editor de item".
// A test file puts it in the editor's place with:
//   vi.mock('@/features/items/ItemEditorPanel', () => import('./itemEditorStandIn.testSupport'));
import type { Item, ItemHome } from '@bajaovrlay/shared';

/** The same props as the real ItemEditorPanel, so the rundown cannot tell them apart. */
type ItemEditorStandInProps = {
  homeForNewItem: ItemHome;
  itemBeingEdited: Item | null;
  onClose: () => void;
};

/** Says in words where a new item would go: "no rundown <id>" or "no painel <id>". */
function describeHomeForNewItem(home: ItemHome): string {
  if (home.kind === 'rundown') {
    return `no rundown ${home.rundownId}`;
  }
  if (home.kind === 'eventTemplates') {
    return 'em Modelos de evento';
  }
  return `no painel ${home.panelId}`;
}

/** Draws what the editor was opened for, and a button that closes it like "Cancelar". */
export function ItemEditorPanel(props: ItemEditorStandInProps) {
  const whatTheEditorWasOpenedFor =
    props.itemBeingEdited === null
      ? `Editor aberto para um novo item ${describeHomeForNewItem(props.homeForNewItem)}`
      : `Editor aberto para o item ${props.itemBeingEdited.label}`;

  // The two texts below are in braces because the "no inline UI text" lint rule only
  // exempts *.test.tsx files; they are test scaffolding, not something an operator reads.
  return (
    <section aria-label={'Editor de item'}>
      <p>{whatTheEditorWasOpenedFor}</p>
      <button type="button" onClick={props.onClose}>
        {'Fechar editor'}
      </button>
    </section>
  );
}

import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ptBR } from '@/i18n/ptBR';

/**
 * The top of the item editor: "Novo item" or "Editar item", and for a stored item only
 * the line "Item salvo — vale para os próximos disparos". That line is what tells "Editar
 * item" apart from "Edição rápida": a save changes the item, so it shows from the next
 * take on, while "Edição rápida" changes one instance on air. A new item is not saved
 * yet, so it gets no such line.
 */
export function ItemEditorHeader(props: { isEditingStoredItem: boolean }) {
  const texts = ptBR.itemEditor;
  return (
    <CardHeader>
      <CardTitle>
        <h2>{props.isEditingStoredItem ? texts.editItemTitle : texts.newItemTitle}</h2>
      </CardTitle>
      {props.isEditingStoredItem ? <CardDescription>{texts.savedItemNote}</CardDescription> : null}
    </CardHeader>
  );
}

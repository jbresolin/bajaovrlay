import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from 'cn';
import { type UseFormReturn, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ptBR } from '@/i18n/ptBR';

import type { SchemaFormFieldDescription } from './schemaFormDescription';
import type { SchemaFormValues } from './schemaFormValues';

const texts = ptBR.textList;

/** What one line of a list of texts needs. */
export type TextListLineRowProps = {
  form: UseFormReturn<SchemaFormValues>;
  field: SchemaFormFieldDescription;
  /** react-hook-form's id of the line, which dnd-kit sorts by. */
  lineId: string;
  /** The line's place in the list, counted from 0. */
  lineIndex: number;
  /** The element id of the line's text input. */
  inputId: string;
  isDisabled: boolean;
  onRemovePressed: () => void;
};

/**
 * One line of a list of texts: a handle to drag it by (its number), the text input, the
 * count of characters against the line's limit when there is one, and "Remover". Every
 * control is named with the line's number ("Mensagem 2", "Remover mensagem 2"), so the
 * third line's button is not the first's. Must be drawn inside TextListField, which owns
 * the dragging and the list.
 */
export function TextListLineRow(props: TextListLineRowProps) {
  const { form, field, lineId, lineIndex, inputId, isDisabled } = props;
  const itemLabel = field.listItemLabel ?? texts.defaultItemLabel;
  const lineNumber = lineIndex + 1;
  const textName = `values.${field.key}.${lineIndex}.text` as const;
  const textNow = useWatch({ control: form.control, name: textName }) ?? '';

  // dnd-kit's hook for one row of a sortable list, as in the macro editor (MacroStepRow.tsx).
  const {
    attributes: dragHandleAttributes,
    listeners: dragHandleListeners,
    setNodeRef: setRowElement,
    setActivatorNodeRef: setDragHandleElement,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lineId,
    disabled: isDisabled,
    attributes: { roleDescription: texts.dragAndDrop.handleRoleDescription },
  });

  return (
    <li
      ref={setRowElement}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-card p-1.5',
        isDragging && 'relative z-10 opacity-70 shadow-md',
      )}
    >
      <button
        type="button"
        ref={setDragHandleElement}
        {...dragHandleAttributes}
        {...dragHandleListeners}
        aria-label={texts.moveLineHandle(itemLabel, lineNumber)}
        className="cursor-grab touch-none rounded-sm px-1 text-sm text-muted-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {lineNumber}
      </button>
      <Input
        id={inputId}
        autoComplete="off"
        aria-label={texts.lineInputLabel(itemLabel, lineNumber)}
        disabled={isDisabled}
        {...form.register(textName)}
      />
      {field.maximumLength !== undefined && (
        // Counted trimmed and in code points, as the check and the server count it: a space
        // typed at the end is not sent, so it does not use up the room left.
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {texts.charactersUsed([...textNow.trim()].length, field.maximumLength)}
        </span>
      )}
      <Button
        type="button"
        size="xs"
        variant="ghost"
        aria-label={texts.removeLineButton(itemLabel, lineNumber)}
        disabled={isDisabled}
        onClick={props.onRemovePressed}
      >
        {texts.removeLineSymbol}
      </Button>
    </li>
  );
}

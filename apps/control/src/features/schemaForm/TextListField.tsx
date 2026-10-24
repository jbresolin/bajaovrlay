import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useState } from 'react';
import { type Control, useFieldArray, type UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { useEscapeBelongsToTheDragWhileDragging } from '@/features/rundown/useEscapeBelongsToTheDragWhileDragging';
import { ptBR } from '@/i18n/ptBR';

import type { SchemaFormFieldDescription } from './schemaFormDescription';
import type { SchemaFormTextListLine, SchemaFormValues } from './schemaFormValues';
import {
  buildTextListDragAnnouncements,
  textListDragInstructionsForScreenReaders,
} from './textListDragAnnouncements';
import { TextListLineRow } from './TextListLineRow';

// A press that moves less than this is a click, not the start of a drag (as in the rundown).
const pointerDistanceThatStartsADragInPixels = 4;

const texts = ptBR.textList;

/**
 * The form as this list reads it: `values.<key>` is the list's lines. The form's own type
 * says a value may be a text, a switch, lines or null (schemaFormValues.ts), and
 * react-hook-form cannot type a field array inside such a choice, so the list's control is
 * narrowed to this once. It is true of every field this component draws: only a
 * `textList` field reaches it, and only lines are ever written to it.
 */
type FormHoldingTextLists = { values: Record<string, SchemaFormTextListLine[]> };

/**
 * A list of texts of a generated form (BAJAOVRLAY-23; the message ticker's messages): one
 * text input per line, "Adicionar <linha>" under them, "Remover" on each line, and the
 * lines put in a new order by dragging a line's numbered handle, with the mouse or from
 * the keyboard (Space or Enter, the arrows, Space or Enter), the macro editor's pattern.
 * The lines live in react-hook-form under `values.<key>`, as `{ text }` objects
 * (schemaFormValues.ts), so the form's check, "Salvar item" and "Atualizar no ar" treat the
 * list like any field. The check's message (too few lines, a line too long, naming its
 * number) is shown under the list. While a line is held, Esc belongs to the drag and never
 * reaches the panic key.
 * A list of texts is always typed: it offers no "Fonte" and no "Cadastro" (nothing of a
 * source or the library is a list of texts).
 */
export function TextListField(props: {
  form: UseFormReturn<SchemaFormValues>;
  field: SchemaFormFieldDescription;
  /** Starts the element ids of the list's parts. */
  controlId: string;
  isDisabled: boolean;
}) {
  const { form, field, controlId, isDisabled } = props;
  const itemLabel = field.listItemLabel ?? texts.defaultItemLabel;
  const helpTextId = `${controlId}-help`;
  const errorMessageId = `${controlId}-error`;
  const errorMessage = form.formState.errors.values?.[field.key]?.message;

  const {
    fields: lines,
    append,
    remove,
    move,
  } = useFieldArray({
    control: form.control as unknown as Control<FormHoldingTextLists>,
    name: `values.${field.key}`,
  });
  const lineIdsInOrder = lines.map((line) => line.id);

  const dragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: pointerDistanceThatStartsADragInPixels },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [isDragActiveOrPending, setIsDragActiveOrPending] = useState(false);
  useEscapeBelongsToTheDragWhileDragging(isDragActiveOrPending);

  function handleDragEnd(dragEnd: DragEndEvent): void {
    setIsDragActiveOrPending(false);
    if (dragEnd.over === null) {
      return;
    }
    const indexBefore = lineIdsInOrder.indexOf(String(dragEnd.active.id));
    const indexAfter = lineIdsInOrder.indexOf(String(dragEnd.over.id));
    const isAMove = indexBefore !== -1 && indexAfter !== -1 && indexBefore !== indexAfter;
    if (isAMove) {
      move(indexBefore, indexAfter);
    }
  }

  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={errorMessage === undefined ? undefined : errorMessageId}
    >
      <legend className="flex items-center gap-1 text-sm leading-none font-medium">
        {field.label}
        {field.isRequired && (
          <span
            aria-hidden="true"
            title={ptBR.schemaForm.requiredMarkerHint}
            className="text-sm leading-none text-destructive"
          >
            {ptBR.schemaForm.requiredMarker}
          </span>
        )}
      </legend>

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{texts.noLines}</p>
      ) : (
        <DndContext
          sensors={dragSensors}
          collisionDetection={closestCenter}
          onDragPending={() => setIsDragActiveOrPending(true)}
          onDragStart={() => setIsDragActiveOrPending(true)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setIsDragActiveOrPending(false)}
          onDragAbort={() => setIsDragActiveOrPending(false)}
          accessibility={{
            announcements: buildTextListDragAnnouncements(lineIdsInOrder),
            screenReaderInstructions: textListDragInstructionsForScreenReaders,
          }}
        >
          <SortableContext items={lineIdsInOrder} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-1.5" aria-label={field.label}>
              {lines.map((line, lineIndex) => (
                <TextListLineRow
                  key={line.id}
                  form={form}
                  field={field}
                  lineId={line.id}
                  lineIndex={lineIndex}
                  inputId={`${controlId}-line-${lineIndex}`}
                  isDisabled={isDisabled}
                  onRemovePressed={() => remove(lineIndex)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isDisabled}
          onClick={() => append({ text: '' })}
        >
          {texts.addLineButton(itemLabel)}
        </Button>
      </div>

      {field.help !== undefined && (
        <p id={helpTextId} className="text-xs text-muted-foreground">
          {field.help}
        </p>
      )}
      {errorMessage !== undefined && (
        <p id={errorMessageId} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </fieldset>
  );
}

import { Controller, type UseFormReturn } from 'react-hook-form';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';

import { listEventPathChoicesOfField } from './eventFieldFormValue';
import type { SchemaFormFieldDescription } from './schemaFormDescription';
import type { SchemaFormValues } from './schemaFormValues';

const editorTexts = ptBR.events.editor;

/**
 * The controls of a field set to "Evento" (BAJAOVRLAY-44): which field of the event's
 * payload fills it (only those that fit), and a note that such an item goes on air through
 * the Eventos tab only. The choice lives in react-hook-form under `eventPaths.<key>`.
 */
export function EventFieldControls(props: {
  form: UseFormReturn<SchemaFormValues>;
  field: SchemaFormFieldDescription;
  dataSchema: unknown;
  controlId: string;
  isDisabled: boolean;
}) {
  const { form, field, dataSchema, controlId, isDisabled } = props;
  const pathSelectorId = `${controlId}-event-path`;
  const choices = listEventPathChoicesOfField(dataSchema, field.key);
  return (
    <div className="flex flex-col gap-2">
      <Controller
        control={form.control}
        name={`eventPaths.${field.key}`}
        render={({ field: pathField }) => (
          <div className="flex flex-col gap-1">
            <Label htmlFor={pathSelectorId} className="text-xs text-muted-foreground">
              {editorTexts.pathLabel(field.label)}
            </Label>
            <Select
              value={pathField.value ?? ''}
              onValueChange={pathField.onChange}
              disabled={isDisabled}
            >
              <SelectTrigger id={pathSelectorId} size="sm" className="w-full">
                <SelectValue placeholder={editorTexts.pathPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {choices.map((choice) => (
                  <SelectItem key={choice.path} value={choice.path}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      />
      <p className="text-xs text-muted-foreground">{editorTexts.filledByTheEventNote}</p>
    </div>
  );
}

import { type InboxEventPayload } from '@bajaovrlay/shared';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';

import {
  describeEventPathWithItsExample,
  listEventPathChoicesOfField,
} from './eventFieldFormValue';
import type { SchemaFormFieldDescription } from './schemaFormDescription';
import type { SchemaFormValues } from './schemaFormValues';

const editorTexts = ptBR.events.editor;

/**
 * The controls of a field set to "Evento" (BAJAOVRLAY-44): which field of the event's
 * payload fills it (only those that fit), and a note that such an item goes on air through
 * the Eventos tab only. On a template opened with its kind's sample event (BAJAOVRLAY-67),
 * a line says where the value comes from, with the sample's value: "Do evento › Tempo da
 * volta (texto) · exemplo: 4:38,2". The choice lives in react-hook-form under
 * `eventPaths.<key>`.
 */
export function EventFieldControls(props: {
  form: UseFormReturn<SchemaFormValues>;
  field: SchemaFormFieldDescription;
  dataSchema: unknown;
  controlId: string;
  isDisabled: boolean;
  sampleEventPayload: InboxEventPayload | undefined;
}) {
  const { form, field, dataSchema, controlId, isDisabled, sampleEventPayload } = props;
  const pathSelectorId = `${controlId}-event-path`;
  const choices = listEventPathChoicesOfField(dataSchema, field.key);
  const chosenPath = useWatch({ control: form.control, name: `eventPaths.${field.key}` }) ?? '';
  const pathWithItsExample =
    sampleEventPayload === undefined
      ? undefined
      : describeEventPathWithItsExample(chosenPath, sampleEventPayload);
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
      {pathWithItsExample === undefined ? null : <p className="text-xs">{pathWithItsExample}</p>}
      <p className="text-xs text-muted-foreground">{editorTexts.filledByTheEventNote}</p>
    </div>
  );
}

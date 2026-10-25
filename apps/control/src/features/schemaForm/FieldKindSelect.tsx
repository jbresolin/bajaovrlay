import { Controller, type UseFormReturn } from 'react-hook-form';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';

import type { SchemaFormFieldDescription } from './schemaFormDescription';
import type { SchemaFormFieldKind, SchemaFormValues } from './schemaFormValues';

/**
 * The kind selector of a field row, "Como preencher …": typed, filled at the take,
 * "Fonte", "Relógio da fonte", "Evento" or "Cadastro", as many of them as the row offers
 * (fieldKindsOffered.ts). The choice lives in react-hook-form under `kinds.<key>`.
 */
export function FieldKindSelect(props: {
  form: UseFormReturn<SchemaFormValues>;
  field: SchemaFormFieldDescription;
  /** The selector's own element id. */
  controlId: string;
  kindsOffered: SchemaFormFieldKind[];
  /** The id of the note read out with the selector (filled at the take), if any. */
  describedById: string | undefined;
  isDisabled: boolean;
}) {
  const { form, field, controlId, kindsOffered, describedById, isDisabled } = props;
  return (
    <Controller
      control={form.control}
      name={`kinds.${field.key}`}
      render={({ field: kindField }) => (
        <Select value={kindField.value} onValueChange={kindField.onChange} disabled={isDisabled}>
          <SelectTrigger
            id={controlId}
            size="sm"
            className="w-full"
            aria-label={ptBR.schemaForm.kindSelectorLabel(field.label)}
            aria-describedby={describedById}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {kindsOffered.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {ptBR.schemaForm.kindLabels[kind]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

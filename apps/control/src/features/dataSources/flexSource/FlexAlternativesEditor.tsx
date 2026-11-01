import type { MappableFieldLevel } from '@bajaovrlay/shared';
import { Controller, useFieldArray, type UseFormReturn, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';

import {
  type AlternativeSourceKind,
  buildEmptyAlternativeFormValues,
} from './flexFieldRuleFormValues';
import { FlexReadingControls } from './FlexReadingControls';
import type { FlexSourceFormValues } from './flexSourceFormValues';

const texts = ptBR.dataSources.flexForm;

// The outer element, a lookup and a column belong to an item of a list, so a shape's own
// field offers paths and fixed values only (the schema refuses the others there anyway).
const alternativeKindsOfTopLevelFields: readonly AlternativeSourceKind[] = ['path', 'constant'];
const alternativeKindsOfEntryFields: readonly AlternativeSourceKind[] = [
  'path',
  'parent',
  'lookup',
  'column',
  'constant',
];

/**
 * "Alternativas" of one field (BAJAOVRLAY-53): the readings tried in order, the first
 * value present and not empty winning, a fixed value allowed last. Each alternative has
 * its kind and its reading controls (FlexReadingControls), and can be removed; "+
 * Alternativa" adds one read by path.
 */
export function FlexAlternativesEditor(props: {
  form: UseFormReturn<FlexSourceFormValues>;
  rowPath: `mappings.${number}.fieldRules.${number}`;
  fieldLabel: string;
  level: MappableFieldLevel;
  lookupNamesToOffer: string[];
  controlIdPrefix: string;
}) {
  const { form, rowPath, fieldLabel } = props;
  const alternatives = useFieldArray({ control: form.control, name: `${rowPath}.alternatives` });
  const alternativeValues = useWatch({ control: form.control, name: `${rowPath}.alternatives` });
  const kindsOffered =
    props.level === 'entry' ? alternativeKindsOfEntryFields : alternativeKindsOfTopLevelFields;

  return (
    <div
      role="group"
      aria-label={texts.alternatives.label(fieldLabel)}
      className="flex flex-col gap-2 rounded-md bg-muted p-2 md:ml-48"
    >
      <p className="text-xs text-muted-foreground">{texts.alternatives.hint}</p>
      {alternatives.fields.map((alternativeField, alternativeIndex) => {
        const alternativeName = texts.alternatives.ofField(alternativeIndex + 1, fieldLabel);
        const alternativePath = `${rowPath}.alternatives.${alternativeIndex}` as const;
        const sourceKind = alternativeValues[alternativeIndex]?.sourceKind ?? 'path';
        return (
          <div key={alternativeField.id} className="flex flex-wrap items-center gap-2">
            <Controller
              control={form.control}
              name={`${alternativePath}.sourceKind`}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    aria-label={texts.alternatives.sourceKind(alternativeName)}
                    className="w-40 bg-background"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {kindsOffered.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {texts.fieldRule.sourceKinds[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FlexReadingControls
              form={form}
              readingPath={alternativePath}
              sourceKind={sourceKind}
              lookupNamesToOffer={props.lookupNamesToOffer}
              controlIdPrefix={`${props.controlIdPrefix}-alternatives-${alternativeIndex}`}
              labels={{
                path: texts.alternatives.path(alternativeName),
                constant: texts.alternatives.constant(alternativeName),
                lookupName: texts.alternatives.lookupName(alternativeName),
                lookupPath: texts.alternatives.path(alternativeName),
                columnHeader: texts.alternatives.columnHeader(alternativeName),
                columnPath: texts.alternatives.path(alternativeName),
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => alternatives.remove(alternativeIndex)}
            >
              {texts.alternatives.removeButton(alternativeName)}
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => alternatives.append(buildEmptyAlternativeFormValues())}
      >
        {texts.alternatives.addButton}
      </Button>
    </div>
  );
}

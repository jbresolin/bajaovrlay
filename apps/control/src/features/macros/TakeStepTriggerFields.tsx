import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';

import type { GraphicFieldOfTakeStep } from './takeStepTriggerFields';

const texts = ptBR.triggers.takeStep;

/** The two places a field's value can come from, as the per-field selector lists them. */
type FieldSource = 'item' | 'triggerData';

/**
 * Under a "Pôr item no ar" step: each field of the item's graphic with where its value
 * comes from, "Valor do item" (the item as prepared) or "Dado do gatilho › <chave>"
 * (BAJAOVRLAY-48), the same per-field choice the item editor offers between its kinds.
 * Folded behind "Campos do gatilho" so a plain take stays one line; open from the start
 * when the step already reads the trigger. Once any field comes from the trigger, the note
 * says what a run by hand does: no trigger data, so a required field stops the macro at
 * this step and an optional one is left out.
 */
export function TakeStepTriggerFields(props: {
  stepNumber: number;
  fields: GraphicFieldOfTakeStep[];
  triggerKeyByFieldKey: Record<string, string>;
  onTriggerKeysChanged: (triggerKeyByFieldKey: Record<string, string>) => void;
}) {
  const { stepNumber, fields, triggerKeyByFieldKey } = props;
  const isAnyFieldFromTheTrigger = Object.keys(triggerKeyByFieldKey).length > 0;
  const [isShowingFields, setIsShowingFields] = useState(isAnyFieldFromTheTrigger);

  function chooseSourceOfField(fieldKey: string, source: FieldSource): void {
    const keysAfter = { ...triggerKeyByFieldKey };
    if (source === 'triggerData') {
      keysAfter[fieldKey] = keysAfter[fieldKey] ?? '';
    } else {
      delete keysAfter[fieldKey];
    }
    props.onTriggerKeysChanged(keysAfter);
  }

  function typeKeyOfField(fieldKey: string, key: string): void {
    props.onTriggerKeysChanged({ ...triggerKeyByFieldKey, [fieldKey]: key });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        size="xs"
        variant="ghost"
        className="self-start"
        aria-expanded={isShowingFields}
        aria-label={texts.showFieldsButtonLabel(stepNumber)}
        onClick={() => setIsShowingFields(!isShowingFields)}
      >
        {texts.showFieldsButton}
      </Button>
      {isShowingFields ? (
        <fieldset aria-label={texts.fieldsLegend(stepNumber)} className="flex flex-col gap-1.5">
          {fields.length === 0 ? (
            <p className="text-xs text-muted-foreground">{texts.noFields}</p>
          ) : null}
          {fields.map((field) => {
            const key = triggerKeyByFieldKey[field.fieldKey];
            const source: FieldSource = key === undefined ? 'item' : 'triggerData';
            return (
              <div key={field.fieldKey} className="grid grid-cols-3 items-center gap-2 text-sm">
                <span>
                  {field.title}{' '}
                  {field.isRequired ? (
                    <span className="text-xs text-muted-foreground">{texts.requiredMark}</span>
                  ) : null}
                </span>
                <Select
                  value={source}
                  onValueChange={(chosenSource) =>
                    chooseSourceOfField(field.fieldKey, chosenSource as FieldSource)
                  }
                >
                  <SelectTrigger
                    size="sm"
                    className="w-full"
                    aria-label={texts.fieldSourceLabel(field.title, stepNumber)}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="item">{texts.fieldSourceNames.item}</SelectItem>
                    <SelectItem value="triggerData">
                      {texts.fieldSourceNames.triggerData}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {key === undefined ? (
                  <span />
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-xs whitespace-nowrap text-muted-foreground">
                      {texts.keyPrefix}
                    </span>
                    <Input
                      autoComplete="off"
                      aria-label={texts.keyLabel(field.title, stepNumber)}
                      value={key}
                      onChange={(change) => typeKeyOfField(field.fieldKey, change.target.value)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>
      ) : null}
      {isAnyFieldFromTheTrigger ? (
        <p className="text-xs text-muted-foreground">{texts.byHandNote}</p>
      ) : null}
    </div>
  );
}

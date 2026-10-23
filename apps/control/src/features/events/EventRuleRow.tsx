import type { EventRule, EventRuleMode, Item } from '@bajaovrlay/shared';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommandAndReadItsRefusal } from '@/state/ControlPageStateProvider';

import {
  buildEventRuleFormValues,
  type EventRuleFormValues,
  listModesOfferedForKind,
  noItemChoice,
  readEventRuleFormIntoCommand,
} from './eventRuleForm';

const texts = ptBR.events.rules;

/**
 * One row of "Regras": the kind's mode, its item, its seconds on air and its maximum wait,
 * and "Salvar", which sends the whole row as updateEventRule (eventRuleForm.ts). A problem
 * or the server's refusal is shown in the row. The Super Chat row offers "Perguntar" only
 * and says why.
 */
export function EventRuleRow(props: { rule: EventRule; items: Item[] }) {
  const { rule, items } = props;
  const sendCommandAndReadItsRefusal = useSendCommandAndReadItsRefusal();
  const [values, setValues] = useState<EventRuleFormValues>(() => buildEventRuleFormValues(rule));
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);
  const kindName = texts.kindNames[rule.kind];
  const idPrefix = `event-rule-${rule.kind}`;
  const modesOffered = listModesOfferedForKind(rule.kind);

  async function saveTheRow(): Promise<void> {
    const reading = readEventRuleFormIntoCommand(rule.kind, values);
    if (reading.status === 'problem') {
      setProblem(reading.message);
      return;
    }
    setProblem(undefined);
    setIsWaitingForTheServer(true);
    const refusal = await sendCommandAndReadItsRefusal(reading.command);
    setIsWaitingForTheServer(false);
    setProblem(refusal ?? undefined);
  }

  return (
    <fieldset aria-label={kindName} className="flex flex-col gap-2 rounded-md border p-2">
      <legend className="px-1 text-sm font-semibold">{kindName}</legend>
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={values.mode}
          onValueChange={(mode) => setValues({ ...values, mode: mode as EventRuleMode })}
        >
          <SelectTrigger size="sm" className="w-full" aria-label={texts.modeLabel(kindName)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {modesOffered.map((mode) => (
              <SelectItem key={mode} value={mode}>
                {texts.modes[mode]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={values.itemChoice}
          onValueChange={(itemChoice) => setValues({ ...values, itemChoice })}
        >
          <SelectTrigger size="sm" className="w-full" aria-label={texts.itemLabel(kindName)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={noItemChoice}>{texts.noItem}</SelectItem>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${idPrefix}-duration`} className="text-xs">
            {texts.durationLabel(kindName)}
          </Label>
          <Input
            id={`${idPrefix}-duration`}
            inputMode="numeric"
            autoComplete="off"
            value={values.durationSecondsText}
            onChange={(event) => setValues({ ...values, durationSecondsText: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${idPrefix}-max-age`} className="text-xs">
            {texts.maxAgeLabel(kindName)}
          </Label>
          <Input
            id={`${idPrefix}-max-age`}
            inputMode="numeric"
            autoComplete="off"
            placeholder={texts.noMaxAgePlaceholder}
            value={values.maxAgeSecondsText}
            onChange={(event) => setValues({ ...values, maxAgeSecondsText: event.target.value })}
          />
        </div>
      </div>
      {rule.kind === 'superChat' ? (
        <p className="text-xs text-muted-foreground">{texts.superChatExplanation}</p>
      ) : null}
      {problem === undefined ? null : (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      <Button
        type="button"
        size="xs"
        className="self-start"
        disabled={isWaitingForTheServer}
        onClick={() => void saveTheRow()}
      >
        {texts.saveButton}
      </Button>
    </fieldset>
  );
}

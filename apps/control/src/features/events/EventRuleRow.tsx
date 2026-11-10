import {
  type EventRule,
  type EventRuleMode,
  type Graphic,
  type Item,
  whyTheDataRoleCannotAutomate,
} from '@bajaovrlay/shared';
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
import { useIsTheDataRoleLoggedIn } from '@/state/operatorSessionContext';

import {
  buildEventRuleFormValues,
  type EventRuleFormValues,
  listModesOfferedForKind,
  noItemChoice,
  readEventRuleFormIntoCommand,
} from './eventRuleForm';
import { EventRuleTemplateControls } from './EventRuleTemplateControls';

const texts = ptBR.events.rules;

/**
 * One row of "Regras": the kind's mode, its template ("Trocar": the templates its events
 * fill, BAJAOVRLAY-67), its seconds on air and its maximum wait, and "Salvar", which sends
 * the whole row as updateEventRule (eventRuleForm.ts). Above them, what the kind appears
 * as, with "Editar aparência", "Prévia" and "+ Novo modelo" (EventRuleTemplateControls.tsx). A problem
 * or the server's refusal is shown in the row, and "Salvo." once the server accepted it. The Super Chat row offers "Perguntar" only
 * and says why. For Dados (gate 2 of PR #51), "Automático" is greyed out unless the rule
 * already was; an auto rule kept auto has its item and times greyed out too, each with the
 * server's sentence: what goes on air by itself is the Produtor's.
 */
export function EventRuleRow(props: {
  rule: EventRule;
  /** The templates the kind's events fill, offered in "Trocar". */
  templatesOffered: Item[];
  /** The template the rule names now, or undefined. */
  templateOfTheRule: Item | undefined;
  graphicsForANewTemplate: Graphic[];
  onEditTemplate: (template: Item) => void;
  onNewTemplate: (graphic: Graphic) => void;
}) {
  const { rule } = props;
  const items = props.templatesOffered;
  const sendCommandAndReadItsRefusal = useSendCommandAndReadItsRefusal();
  const [values, setValues] = useState<EventRuleFormValues>(() => buildEventRuleFormValues(rule));
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  // The row follows the rule as the server holds it: another operator's change, or this
  // row's own save coming back, shows here (gate 2 of PR #22). Compared during the draw,
  // React's way to adjust state when a prop changes, so no extra draw happens. What could
  // go wrong: a change made elsewhere while this row is being edited replaces what was typed.
  const [ruleTheValuesCameFrom, setRuleTheValuesCameFrom] = useState(rule);
  if (rule !== ruleTheValuesCameFrom) {
    setRuleTheValuesCameFrom(rule);
    setValues(buildEventRuleFormValues(rule));
  }
  const kindName = texts.kindNames[rule.kind];
  const idPrefix = `event-rule-${rule.kind}`;
  const modesOffered = listModesOfferedForKind(rule.kind);
  const isTheDataRole = useIsTheDataRoleLoggedIn();
  const isAutoGreyedOut = isTheDataRole && rule.mode !== 'auto';
  const isWhatItAirsLocked = isTheDataRole && rule.mode === 'auto' && values.mode === 'auto';
  const isAutoOffered = modesOffered.includes('auto');

  async function saveTheRow(): Promise<void> {
    const reading = readEventRuleFormIntoCommand(rule.kind, values);
    if (reading.status === 'problem') {
      setProblem(reading.message);
      return;
    }
    setProblem(undefined);
    setIsSaved(false);
    setIsWaitingForTheServer(true);
    const refusal = await sendCommandAndReadItsRefusal(reading.command);
    setIsWaitingForTheServer(false);
    setProblem(refusal ?? undefined);
    setIsSaved(refusal === null);
  }

  return (
    <fieldset aria-label={kindName} className="flex flex-col gap-2 rounded-md border p-2">
      <legend className="px-1 text-sm font-semibold">{kindName}</legend>
      <EventRuleTemplateControls
        rule={rule}
        kindName={kindName}
        templateOfTheRule={props.templateOfTheRule}
        graphicsForANewTemplate={props.graphicsForANewTemplate}
        onEditTemplate={props.onEditTemplate}
        onNewTemplate={props.onNewTemplate}
      />
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
              <SelectItem key={mode} value={mode} disabled={mode === 'auto' && isAutoGreyedOut}>
                {texts.modes[mode]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={values.itemChoice}
          disabled={isWhatItAirsLocked}
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
            disabled={isWhatItAirsLocked}
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
            disabled={isWhatItAirsLocked}
            inputMode="numeric"
            autoComplete="off"
            placeholder={texts.noMaxAgePlaceholder}
            value={values.maxAgeSecondsText}
            onChange={(event) => setValues({ ...values, maxAgeSecondsText: event.target.value })}
          />
        </div>
      </div>
      {isAutoGreyedOut && isAutoOffered ? (
        <p className="text-xs text-muted-foreground">
          {whyTheDataRoleCannotAutomate.settingARuleToAuto}
        </p>
      ) : null}
      {isWhatItAirsLocked ? (
        <p className="text-xs text-muted-foreground">
          {whyTheDataRoleCannotAutomate.changingAnAutoRule}
        </p>
      ) : null}
      {rule.kind === 'superChat' ? (
        <p className="text-xs text-muted-foreground">{texts.superChatExplanation}</p>
      ) : null}
      {problem === undefined ? null : (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      {isSaved ? (
        <p role="status" className="text-sm text-muted-foreground">
          {texts.savedConfirmation}
        </p>
      ) : null}
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

import {
  findProblemInOverrideValue,
  labelOfOverridableField,
  type Override,
  type OverrideKey,
} from '@bajaovrlay/shared';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommandAndReadItsAnswer } from '@/state/ControlPageStateProvider';

import { chooseOverrideValueControl, readOverrideValueFromText } from './overrideValueControl';

const texts = ptBR.bindings.overrides;
const valueControlId = 'override-dialog-value';
const reasonControlId = 'override-dialog-reason';

/** What the dialog corrects and where it was opened from. */
export type OverrideDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  /** The source's name as the operator reads it: "Simulador — Enduro". */
  sourceLabel: string;
  /** Which value is corrected: a session field, or a car's field. */
  overrideKey: OverrideKey;
  /** The correction in force for that key, if any: it fills the form and offers removal. */
  overrideInForce: Override | undefined;
  /** What the source says now, written for reading; undefined when it says nothing. */
  valueNowText: string | undefined;
};

/**
 * The dialog of "Corrigir valor…" and "Corrigir valor da fonte…": what is corrected, the
 * source's value now, the corrected value (chooseOverrideValueControl) and the reason,
 * which is required. "Salvar correção" checks the value with the shared rule the server
 * runs (findProblemInOverrideValue), sends setOverride and closes on the server's ok;
 * "Remover correção", only while a correction is in force, sends clearOverride. A refusal
 * from the server is shown in the dialog, which stays open.
 */
export function OverrideDialog(props: OverrideDialogProps) {
  const { isOpen, onClose, sourceLabel, overrideKey, overrideInForce, valueNowText } = props;
  const sendCommand = useSendCommandAndReadItsAnswer();
  const valueControl = chooseOverrideValueControl(overrideKey.field);
  const [valueText, setValueText] = useState(
    overrideInForce === undefined ? '' : String(overrideInForce.value),
  );
  const [reason, setReason] = useState(overrideInForce?.reason ?? '');
  const [problem, setProblem] = useState<string | undefined>(undefined);

  const fieldLabel = labelOfOverridableField(overrideKey.scope, overrideKey.field);
  const whatIsCorrected =
    overrideKey.carNumber === undefined
      ? fieldLabel
      : texts.ofCar(fieldLabel, overrideKey.carNumber);

  /** Checks the value and the reason, then sends the correction. */
  async function saveTheCorrection(): Promise<void> {
    const value = readOverrideValueFromText(overrideKey.field, valueText);
    const problemInValue = findProblemInOverrideValue(overrideKey.scope, overrideKey.field, value);
    if (problemInValue !== undefined) {
      setProblem(problemInValue);
      return;
    }
    if (reason.trim() === '') {
      setProblem(texts.reasonMissing);
      return;
    }
    setProblem(undefined);
    const answer = await sendCommand({ type: 'setOverride', ...overrideKey, value, reason });
    if (answer !== null) {
      onClose();
    }
  }

  /** Sends the removal of the correction in force. */
  async function removeTheCorrection(): Promise<void> {
    const answer = await sendCommand({ type: 'clearOverride', ...overrideKey });
    if (answer !== null) {
      onClose();
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(isOpenNow) => {
        if (!isOpenNow) {
          onClose();
        }
      }}
    >
      <DialogContent closeButtonLabel={texts.closeDialogButton}>
        <DialogHeader>
          <DialogTitle>{texts.title}</DialogTitle>
          <DialogDescription>
            {texts.whatIsCorrected(sourceLabel, whatIsCorrected)}
          </DialogDescription>
        </DialogHeader>
        {valueNowText !== undefined && (
          <p className="text-sm text-muted-foreground">{texts.valueNow(valueNowText)}</p>
        )}
        <div className="flex flex-col gap-1">
          <Label htmlFor={valueControlId}>{texts.valueLabel}</Label>
          {valueControl.kind === 'choice' ? (
            <Select value={valueText} onValueChange={setValueText}>
              <SelectTrigger id={valueControlId} className="w-full" aria-label={texts.valueLabel}>
                <SelectValue placeholder={ptBR.schemaForm.nothingChosenPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {valueControl.choices.map((choice) => (
                  <SelectItem key={choice.value} value={choice.value}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={valueControlId}
              autoComplete="off"
              inputMode={valueControl.kind === 'number' ? 'decimal' : undefined}
              value={valueText}
              onChange={(event) => setValueText(event.target.value)}
            />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={reasonControlId}>{texts.reasonLabel}</Label>
          <Input
            id={reasonControlId}
            autoComplete="off"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        {problem !== undefined && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
        <CommandErrorMessage commandTypes={['setOverride', 'clearOverride']} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void saveTheCorrection()}>
            {texts.saveButton}
          </Button>
          {overrideInForce !== undefined && (
            <Button type="button" variant="secondary" onClick={() => void removeTheCorrection()}>
              {texts.clearButton}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            {texts.cancelButton}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
import { ptBR } from '@/i18n/ptBR';
import { useSendCommandAndReadItsRefusal } from '@/state/ControlPageStateProvider';

import {
  emptyManualEventFormValues,
  type ManualEventFormValues,
  readManualEventFormIntoCommand,
} from './manualEventForm';

const texts = ptBR.events.manualForm;

/** The text inputs of the form, in the order drawn, each with its label and id. */
const textFields: Array<{ key: keyof ManualEventFormValues; label: string; id: string }> = [
  { key: 'carNumberText', label: texts.carLabel, id: 'manual-event-car' },
  { key: 'teamName', label: texts.teamLabel, id: 'manual-event-team' },
  { key: 'schoolName', label: texts.schoolLabel, id: 'manual-event-school' },
  { key: 'reason', label: texts.reasonLabel, id: 'manual-event-reason' },
];

/**
 * "+ Evento" (BAJAOVRLAY-44): a penalty or a notice about one car, typed by the operator.
 * "Criar evento" reads the form (manualEventForm.ts), sends createManualEvent and closes on
 * the server's ok; a problem or a refusal stays in the dialog. Like the correction dialog,
 * it shows its own command's refusal only, and its button is off while it waits.
 */
export function ManualEventDialog(props: { onClose: () => void }) {
  const sendCommandAndReadItsRefusal = useSendCommandAndReadItsRefusal();
  const [values, setValues] = useState<ManualEventFormValues>(emptyManualEventFormValues);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);

  function changeValue(key: keyof ManualEventFormValues, text: string): void {
    setValues((valuesBefore) => ({ ...valuesBefore, [key]: text }));
  }

  async function createTheEvent(): Promise<void> {
    const reading = readManualEventFormIntoCommand(values);
    if (reading.status === 'problem') {
      setProblem(reading.message);
      return;
    }
    setProblem(undefined);
    setIsWaitingForTheServer(true);
    const refusal = await sendCommandAndReadItsRefusal(reading.command);
    setIsWaitingForTheServer(false);
    if (refusal === null) {
      props.onClose();
      return;
    }
    setProblem(refusal);
  }

  return (
    <Dialog
      open
      onOpenChange={(isOpenNow) => {
        if (!isOpenNow) {
          props.onClose();
        }
      }}
    >
      <DialogContent closeButtonLabel={texts.closeButton}>
        <DialogHeader>
          <DialogTitle>{texts.title}</DialogTitle>
          <DialogDescription>{texts.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <Label>{texts.kindLabel}</Label>
          <Select
            value={values.noticeKind}
            onValueChange={(noticeKind) => changeValue('noticeKind', noticeKind)}
          >
            <SelectTrigger className="w-full" aria-label={texts.kindLabel}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="penalty">{texts.kindOptions.penalty}</SelectItem>
              <SelectItem value="notice">{texts.kindOptions.notice}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {textFields.map((textField) => (
          <div key={textField.key} className="flex flex-col gap-1">
            <Label htmlFor={textField.id}>{textField.label}</Label>
            <Input
              id={textField.id}
              autoComplete="off"
              value={values[textField.key]}
              onChange={(event) => changeValue(textField.key, event.target.value)}
            />
          </div>
        ))}
        {values.noticeKind === 'penalty' ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="manual-event-penalty">{texts.penaltyLabel}</Label>
            <Input
              id="manual-event-penalty"
              autoComplete="off"
              placeholder={texts.penaltyPlaceholder}
              value={values.penaltyText}
              onChange={(event) => changeValue('penaltyText', event.target.value)}
            />
          </div>
        ) : null}
        {problem === undefined ? null : (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={isWaitingForTheServer}
            onClick={() => void createTheEvent()}
          >
            {texts.createButton}
          </Button>
          <Button type="button" variant="outline" onClick={props.onClose}>
            {texts.cancelButton}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

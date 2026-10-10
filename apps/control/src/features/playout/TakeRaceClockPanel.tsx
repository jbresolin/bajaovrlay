import { useForm } from 'react-hook-form';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { CommandErrorMessage } from './CommandErrorMessage';
import { RaceClockFormFields } from './RaceClockFormFields';
import {
  buildTakeRaceClockCommand,
  clockLayerId,
  defaultRaceClockTakeFormValues,
  raceClockGraphicId,
  type RaceClockTakeFormValues,
} from './raceClockTakeForm';
import { resolveRaceClockTakeForm } from './raceClockTakeFormResolver';

/** What the panel can be given; the page gives it nothing and gets the real clock. */
export type TakeRaceClockPanelProps = {
  /** Returns "now" as Date.now() does. A parameter so tests can hold the clock still. */
  readCurrentTimeInMilliseconds?: () => number;
};

/**
 * The race clock's form and its two actions. "Colocar no ar" sends `takeGraphic` for
 * the clock layer. "Atualizar", shown while the race clock is on air, sends the very
 * same command with the form as it is now: the server replaces the instance on the
 * layer (there is no update command yet), so the graphic animates in again and the
 * clock restarts from the typed reference time at the moment of the press.
 *
 * Hand-written for M0; BAJAOVRLAY-14 replaces it with a form generated from the manifest.
 */
export function TakeRaceClockPanel(props: TakeRaceClockPanelProps) {
  const readCurrentTimeInMilliseconds = props.readCurrentTimeInMilliseconds ?? Date.now;
  const instances = useServerState((state) => state.instances);
  const sendCommand = useSendCommand();
  const form = useForm<RaceClockTakeFormValues>({
    defaultValues: defaultRaceClockTakeFormValues,
    resolver: resolveRaceClockTakeForm,
  });

  const isRaceClockOnAir = instances.some(
    (instance) =>
      instance.layerId === clockLayerId &&
      instance.target === 'program' &&
      instance.graphicId === raceClockGraphicId,
  );
  // While a take waits for the server's answer both buttons are off, so an impatient
  // second click cannot send the clock to air twice.
  const isWaitingForTheServer = form.formState.isSubmitting;

  // Runs only when every field passed its rule; otherwise react-hook-form puts the
  // messages under the fields and this is never called.
  async function sendFormAsTakeCommand(formValues: RaceClockTakeFormValues): Promise<void> {
    const takeCommand = buildTakeRaceClockCommand(formValues, readCurrentTimeInMilliseconds());
    await sendCommand(takeCommand);
  }
  const checkFormThenSend = form.handleSubmit(sendFormAsTakeCommand);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{ptBR.playout.raceClockPanelTitle}</h2>
        </CardTitle>
      </CardHeader>
      {/* The buttons are plain buttons, not submit buttons, and the form's own submit is
          cancelled: pressing Enter in a text field must never put a graphic on air. */}
      <form onSubmit={(event) => event.preventDefault()} noValidate className="contents">
        <CardContent>
          <RaceClockFormFields form={form} />
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-3">
          <ActionButton type="button" disabled={isWaitingForTheServer} onClick={checkFormThenSend}>
            {ptBR.playout.takeButton}
          </ActionButton>
          {isRaceClockOnAir && (
            <ActionButton
              type="button"
              variant="secondary"
              disabled={isWaitingForTheServer}
              onClick={checkFormThenSend}
            >
              {ptBR.playout.updateButton}
            </ActionButton>
          )}
          <CommandErrorMessage commandTypes={['takeGraphic']} />
        </CardFooter>
      </form>
    </Card>
  );
}

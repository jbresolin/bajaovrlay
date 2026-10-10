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
import { buildUpdateRaceClockCommand } from './raceClockUpdateCommand';

/** What the panel can be given; the page gives it nothing and gets the real clock. */
export type TakeRaceClockPanelProps = {
  /** Returns "now" as Date.now() does. A parameter so tests can hold the clock still. */
  readCurrentTimeInMilliseconds?: () => number;
};

/**
 * The race clock's form and its two actions. "Colocar no ar" sends `takeGraphic` for
 * the clock layer with the typed reference time. "Atualizar", shown while the race
 * clock is on air, sends a `takeGraphic` too (there is no update command yet), but with
 * the time the clock on air shows at the press instead of the typed one, so changing the
 * flag mid-race never resets the clock. The server replaces the instance on the layer,
 * so the graphic still animates out and in; that blink stays until `updateItemFields`
 * lands in M1.
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

  const raceClockInstanceOnAir = instances.find(
    (instance) =>
      instance.layerId === clockLayerId &&
      instance.target === 'program' &&
      instance.graphicId === raceClockGraphicId,
  );
  const isRaceClockOnAir = raceClockInstanceOnAir !== undefined;
  // While a take waits for the server's answer both buttons are off, so an impatient
  // second click cannot send the clock to air twice.
  const isWaitingForTheServer = form.formState.isSubmitting;

  // Both functions run only when every field passed its rule; otherwise react-hook-form
  // puts the messages under the fields and neither is called.
  async function sendFormAsTakeCommand(formValues: RaceClockTakeFormValues): Promise<void> {
    const takeCommand = buildTakeRaceClockCommand(formValues, readCurrentTimeInMilliseconds());
    await sendCommand(takeCommand);
  }
  async function sendFormAsUpdateCommand(formValues: RaceClockTakeFormValues): Promise<void> {
    // The clock can leave the air between the drawing of the button and the press (another
    // operator's "Limpar"). Then there is no time to keep, and undefined makes the update
    // fall back to the typed time.
    const updateCommand = buildUpdateRaceClockCommand(
      formValues,
      raceClockInstanceOnAir?.resolvedData,
      readCurrentTimeInMilliseconds(),
    );
    await sendCommand(updateCommand);
  }
  const checkFormThenTake = form.handleSubmit(sendFormAsTakeCommand);
  const checkFormThenUpdate = form.handleSubmit(sendFormAsUpdateCommand);

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
          <ActionButton type="button" disabled={isWaitingForTheServer} onClick={checkFormThenTake}>
            {ptBR.playout.takeButton}
          </ActionButton>
          {isRaceClockOnAir && (
            <ActionButton
              type="button"
              variant="secondary"
              disabled={isWaitingForTheServer}
              onClick={checkFormThenUpdate}
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

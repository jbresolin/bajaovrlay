import type { Instance } from '@bajaovrlay/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';
import {
  useReadServerStateNow,
  useSendCommand,
  useServerState,
} from '@/state/ControlPageStateProvider';

import { CommandErrorMessage } from './CommandErrorMessage';
import {
  buildRaceClockFormValuesFromDataOnAir,
  readRaceClockDataOnAir,
} from './raceClockDataOnAir';
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
  /**
   * Returns "now" as Date.now() does. A parameter so tests can hold the clock still.
   * Must be the same function on every draw: the form is refilled from what is on air
   * whenever it changes, so a new function per draw would refill it on every draw.
   */
  readCurrentTimeInMilliseconds?: () => number;
};

/** The race clock on the clock layer of the program output, if it is on air. */
function findRaceClockInstanceOnAir(instances: Instance[]): Instance | undefined {
  return instances.find(
    (instance) =>
      instance.layerId === clockLayerId &&
      instance.target === 'program' &&
      instance.graphicId === raceClockGraphicId,
  );
}

/**
 * The race clock's form and its two actions. "Colocar no ar" sends `takeGraphic` for
 * the clock layer with the form as it stands. "Atualizar", shown while the race clock is
 * on air, sends a `takeGraphic` too (there is no update command yet) in which only the
 * fields the operator changed come from the form; the rest is what is on air, the time
 * carried forward to the press. The server replaces the instance on the layer, so the
 * graphic still animates out and in; that blink stays until `updateItemFields` lands in M1.
 *
 * "Changed" is react-hook-form's `dirtyFields`: a field that differs from the value the
 * form was last filled with. So the form is filled from what is on air whenever that
 * changes, and again after every command the server accepts.
 *
 * Hand-written for M0; BAJAOVRLAY-14 replaces it with a form generated from the manifest.
 */
export function TakeRaceClockPanel(props: TakeRaceClockPanelProps) {
  const readCurrentTimeInMilliseconds = props.readCurrentTimeInMilliseconds ?? Date.now;
  const instances = useServerState((state) => state.instances);
  const readServerStateNow = useReadServerStateNow();
  const sendCommand = useSendCommand();
  const form = useForm<RaceClockTakeFormValues>({
    defaultValues: defaultRaceClockTakeFormValues,
    resolver: resolveRaceClockTakeForm,
  });
  const resetForm = form.reset;
  // Read here, while drawing, and not inside the button handler: react-hook-form keeps
  // up to date only the parts of `formState` a component reads as it draws.
  const fieldsTheOperatorChanged = form.formState.dirtyFields;

  const raceClockInstanceOnAir = findRaceClockInstanceOnAir(instances);
  const isRaceClockOnAir = raceClockInstanceOnAir !== undefined;
  // While a press is being checked and its command waits for the server's answer both
  // buttons are off, so an impatient second click cannot send the clock to air twice.
  // The panel keeps this flag itself instead of reading react-hook-form's `isSubmitting`:
  // every `reset` switches that one off, and the form is reset whenever news about the
  // clock arrives, which can be in the middle of the wait.
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);

  // Whenever what is on air changes (the page has just loaded with the clock on air, or
  // another operator changed it) the form follows it. `keepDirtyValues` is what protects
  // an edit the operator has not sent yet: changed fields keep their text, untouched
  // fields take the on-air value. Data that cannot be read, or no clock on air at all,
  // leaves the form as it is. `keepErrors` keeps the message under a badly typed field
  // next to its text, and `keepIsSubmitted` keeps the form checking that field again as
  // the operator corrects it. What could go wrong: the time shown in an untouched field
  // is the time at this moment and does not tick (see buildRaceClockFormValuesFromDataOnAir);
  // and a message under an untouched field (an empty session name that came from the air)
  // stays after someone else corrects that value on air, until this operator's next press.
  useEffect(() => {
    const raceClockDataOnAir = readRaceClockDataOnAir(raceClockInstanceOnAir?.resolvedData);
    if (raceClockDataOnAir === undefined) {
      return;
    }
    const formValuesOnAir = buildRaceClockFormValuesFromDataOnAir(
      raceClockDataOnAir,
      readCurrentTimeInMilliseconds(),
    );
    resetForm(formValuesOnAir, {
      keepDirtyValues: true,
      keepErrors: true,
      keepIsSubmitted: true,
    });
  }, [raceClockInstanceOnAir, readCurrentTimeInMilliseconds, resetForm]);

  // After a command the server accepted nothing in the form is an unsent edit any more,
  // so every field is filled from what is on air and counts as untouched again. The
  // instance is read from the store at this moment, not taken from the last drawing: the
  // server sends the changed instances before its "ok" (webSocketHub.ts), so the store
  // already holds the instance this command created. If its data cannot be read the form
  // is left alone, as above.
  function fillFormFromWhatIsOnAirNow(): void {
    const raceClockInstanceOnAirNow = findRaceClockInstanceOnAir(readServerStateNow().instances);
    const raceClockDataOnAirNow = readRaceClockDataOnAir(raceClockInstanceOnAirNow?.resolvedData);
    if (raceClockDataOnAirNow === undefined) {
      return;
    }
    const formValuesOnAirNow = buildRaceClockFormValuesFromDataOnAir(
      raceClockDataOnAirNow,
      readCurrentTimeInMilliseconds(),
    );
    resetForm(formValuesOnAirNow);
  }

  // Both functions run only when every field passed its rule; otherwise react-hook-form
  // puts the messages under the fields and neither is called.
  async function sendFormAsTakeCommand(formValues: RaceClockTakeFormValues): Promise<void> {
    const takeCommand = buildTakeRaceClockCommand(formValues, readCurrentTimeInMilliseconds());
    const wasAcceptedByTheServer = await sendCommand(takeCommand);
    if (wasAcceptedByTheServer) {
      fillFormFromWhatIsOnAirNow();
    }
  }
  async function sendFormAsUpdateCommand(formValues: RaceClockTakeFormValues): Promise<void> {
    // The `?.` is here only because the type allows undefined: "Atualizar" is drawn only
    // while the clock is on air, so a press always finds the instance of that same drawing
    // (were it undefined, the builder would send the whole form). What can go wrong: a
    // press that races another operator's "Limpar" still sees that instance, and puts the
    // clock back on air with the time it last showed.
    const updateCommand = buildUpdateRaceClockCommand({
      formValues,
      fieldsTheOperatorChanged,
      raceClockDataOnAir: raceClockInstanceOnAir?.resolvedData,
      nowInMilliseconds: readCurrentTimeInMilliseconds(),
    });
    const wasAcceptedByTheServer = await sendCommand(updateCommand);
    if (wasAcceptedByTheServer) {
      fillFormFromWhatIsOnAirNow();
    }
  }
  const checkFormThenTake = form.handleSubmit(sendFormAsTakeCommand);
  const checkFormThenUpdate = form.handleSubmit(sendFormAsUpdateCommand);

  // What a press on either button does: both buttons go off, the form is checked and, if
  // it passes, sent; the buttons come back whatever the outcome (accepted, refused, no
  // answer within 5 s, or a field that failed its rule).
  async function runWithBothButtonsOff(checkFormThenSend: () => Promise<void>): Promise<void> {
    setIsWaitingForTheServer(true);
    try {
      await checkFormThenSend();
    } finally {
      setIsWaitingForTheServer(false);
    }
  }

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
          <ActionButton
            type="button"
            disabled={isWaitingForTheServer}
            onClick={() => runWithBothButtonsOff(checkFormThenTake)}
          >
            {ptBR.playout.takeButton}
          </ActionButton>
          {isRaceClockOnAir && (
            <ActionButton
              type="button"
              variant="secondary"
              disabled={isWaitingForTheServer}
              onClick={() => runWithBothButtonsOff(checkFormThenUpdate)}
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

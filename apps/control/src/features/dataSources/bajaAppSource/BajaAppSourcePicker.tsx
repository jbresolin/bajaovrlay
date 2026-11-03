import { bajaAppApiAddress, proposedScorePartHeaders } from '@bajaovrlay/shared';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { buildErrorAttributesForControl, FormFieldRow } from '@/features/items/FormFieldRow';
import { ptBR } from '@/i18n/ptBR';

import { fetchHttpJsonSample } from '../flexSource/fetchHttpJsonSample';
import type { FlexSourceStartingPoint } from '../flexSource/flexSourceFormValues';
import {
  type BajaAppEventChoices as EventChoices,
  type BajaAppTableChoice,
  readBajaAppEventAnswer,
  readBajaAppTableColumns,
} from './bajaAppAnswerReading';
import {
  BajaAppRaceOptions,
  BajaAppTableOptions,
  type TableColumnsState,
} from './BajaAppChoiceOptions';
import { type BajaAppChoiceKey, BajaAppEventChoices } from './BajaAppEventChoices';
import { BajaAppOtherResultOption, type OtherResultState } from './BajaAppOtherResultOption';
import { readBajaAppResultById } from './bajaAppResultById';
import { buildBajaAppEventRequest, buildBajaAppTableRequest } from './bajaAppSampleRequests';
import {
  type BajaAppChoice,
  type BajaAppEventAddress,
  buildBajaAppSourceOfChoice,
} from './bajaAppSourceOfChoice';
import { findProblemOfTypedApiAddress, findProblemOfTypedEventId } from './bajaAppTypedIds';

const texts = ptBR.dataSources.bajaApp;

/** The event as the picker holds it: not read yet, being read, refused, or read. */
type EventReadingState =
  | { phase: 'notRead' }
  | { phase: 'reading' }
  | { phase: 'failed'; reason: string }
  | { phase: 'read'; where: BajaAppEventAddress; event: EventChoices };

/** What the page gives the picker. */
export type BajaAppSourcePickerProps = {
  /** Called with the chosen preset filled in: the page opens the flex form with it. */
  onContinue: (startingPoint: FlexSourceStartingPoint) => void;
  onClose: () => void;
};

/**
 * "Adicionar fonte do app Baja" (BAJAOVRLAY-54): the operator types the event id (and,
 * only for a local copy, the API's address), the page reads the event through the
 * server's sample route and lists what it offers (BajaAppEventChoices.tsx), and a result
 * the menu leaves out may be typed by its id (BajaAppOtherResultOption.tsx). A race may
 * accept a simulation; a table is read too, for its points column and its parts.
 * "Continuar" hands the chosen preset, filled in, to the page, which opens the ordinary
 * flex form with it: nothing is saved here.
 */
export function BajaAppSourcePicker(props: BajaAppSourcePickerProps) {
  const idPrefix = useId();
  const ids = { apiAddress: `${idPrefix}-endereco`, eventId: `${idPrefix}-evento` };
  const [apiAddress, setApiAddress] = useState(bajaAppApiAddress);
  const [eventId, setEventId] = useState('');
  // What is wrong with what was typed, under the field it belongs to.
  const [addressProblem, setAddressProblem] = useState<string | undefined>(undefined);
  const [eventIdProblem, setEventIdProblem] = useState<string | undefined>(undefined);
  const [eventReading, setEventReading] = useState<EventReadingState>({ phase: 'notRead' });
  const [chosenKey, setChosenKey] = useState<BajaAppChoiceKey | null>(null);
  const [acceptsSimulatedRace, setAcceptsSimulatedRace] = useState(false);
  const [tableColumns, setTableColumns] = useState<TableColumnsState | null>(null);
  const [otherResult, setOtherResult] = useState<OtherResultState>({ phase: 'notRead' });

  async function readTheEvent(): Promise<void> {
    const where = { apiAddress: apiAddress.trim(), eventId: eventId.trim() };
    const typedAddressProblem = findProblemOfTypedApiAddress(where.apiAddress);
    const typedEventIdProblem = findProblemOfTypedEventId(where.eventId);
    setAddressProblem(typedAddressProblem);
    setEventIdProblem(typedEventIdProblem);
    if (typedAddressProblem !== undefined || typedEventIdProblem !== undefined) {
      return;
    }
    setChosenKey(null);
    setTableColumns(null);
    setOtherResult({ phase: 'notRead' });
    setEventReading({ phase: 'reading' });
    const answer = await fetchHttpJsonSample(
      buildBajaAppEventRequest(where.apiAddress, where.eventId),
    );
    if (!answer.ok) {
      setEventReading({ phase: 'failed', reason: answer.error });
      return;
    }
    const reading = readBajaAppEventAnswer(answer.body);
    setEventReading(
      reading.isRead
        ? { phase: 'read', where, event: reading.event }
        : { phase: 'failed', reason: reading.reason },
    );
  }

  async function readTheColumnsOfTable(where: BajaAppEventAddress, resultadoId: string) {
    setTableColumns({ phase: 'reading', resultadoId });
    const request = buildBajaAppTableRequest(where.apiAddress, where.eventId, resultadoId);
    const answer = await fetchHttpJsonSample(request);
    const reading = answer.ok
      ? readBajaAppTableColumns(answer.body)
      : { isRead: false as const, reason: answer.error };
    const columnsRead: TableColumnsState = reading.isRead
      ? buildColumnsRead(resultadoId, reading.pointsHeader, reading.partHeaderChoices)
      : { phase: 'failed', resultadoId, reason: reading.reason };
    // A table the operator left meanwhile for another choice is not shown.
    setTableColumns((current) => (current?.resultadoId === resultadoId ? columnsRead : current));
  }

  async function readTheOtherResult(where: BajaAppEventAddress, resultadoId: string) {
    setOtherResult({ phase: 'reading' });
    setTableColumns(null);
    const reading = await readBajaAppResultById(where, resultadoId);
    if (!reading.isRead) {
      setOtherResult({ phase: 'failed', reason: reading.reason });
      return;
    }
    if (reading.kind === 'tournament') {
      setOtherResult({ phase: 'tournament', tournament: reading.tournament });
      return;
    }
    setOtherResult({ phase: 'table', table: reading.table });
    setTableColumns(buildColumnsRead(resultadoId, reading.pointsHeader, reading.partHeaderChoices));
  }

  function choose(choiceKey: BajaAppChoiceKey): void {
    setChosenKey(choiceKey);
    setTableColumns(null);
    setOtherResult({ phase: 'notRead' });
    if (eventReading.phase === 'read' && choiceKey.startsWith('table:')) {
      void readTheColumnsOfTable(eventReading.where, choiceKey.slice('table:'.length));
    }
  }

  const choice = eventReading.phase === 'read' ? buildChoice(eventReading.event) : undefined;

  /** The choice made, with its options, once it has all it needs; undefined until then. */
  function buildChoice(event: EventChoices): BajaAppChoice | undefined {
    if (chosenKey === 'other') {
      return buildChoiceOfTheOtherResult();
    }
    const race = event.races.find((candidate) => `race:${candidate.provaId}` === chosenKey);
    if (race !== undefined) {
      return { kind: 'race', race, acceptsSimulatedRace };
    }
    const tournament = event.tournaments.find(
      (candidate) => `tournament:${candidate.resultadoId}` === chosenKey,
    );
    if (tournament !== undefined) {
      return { kind: 'tournament', tournament };
    }
    const table = event.tables.find((candidate) => `table:${candidate.resultadoId}` === chosenKey);
    return table === undefined ? undefined : buildChoiceOfTable(table);
  }

  /** A table chosen, once its columns are read: its points and the parts left ticked. */
  function buildChoiceOfTable(table: BajaAppTableChoice): BajaAppChoice | undefined {
    const areItsColumnsRead =
      tableColumns?.phase === 'read' && tableColumns.resultadoId === table.resultadoId;
    if (!areItsColumnsRead) {
      return undefined;
    }
    return {
      kind: 'table',
      table,
      pointsHeader: tableColumns.pointsHeader,
      partHeaders: tableColumns.tickedPartHeaders,
    };
  }

  /** The result typed by its id, once read: a tournament, or a table with its columns. */
  function buildChoiceOfTheOtherResult(): BajaAppChoice | undefined {
    if (otherResult.phase === 'tournament') {
      return { kind: 'tournament', tournament: otherResult.tournament };
    }
    if (otherResult.phase === 'table') {
      return buildChoiceOfTable(otherResult.table);
    }
    return undefined;
  }

  function continueWithTheChoice(): void {
    if (eventReading.phase === 'read' && choice !== undefined) {
      props.onContinue(buildBajaAppSourceOfChoice(eventReading.where, choice));
    }
  }

  /**
   * The chosen entry's own options: the race's box, the id to type for another result, or
   * the table's columns; else none.
   */
  function drawOptionsOfTheChoice() {
    if (chosenKey?.startsWith('race:') === true) {
      return (
        <BajaAppRaceOptions
          acceptsSimulatedRace={acceptsSimulatedRace}
          onChange={setAcceptsSimulatedRace}
        />
      );
    }
    if (chosenKey === 'other' && eventReading.phase === 'read') {
      const where = eventReading.where;
      return (
        <BajaAppOtherResultOption
          eventId={where.eventId}
          otherResult={otherResult}
          onRead={(resultadoId) => void readTheOtherResult(where, resultadoId)}
          tableOptions={drawTableOptions()}
        />
      );
    }
    return drawTableOptions();
  }

  /** A table's columns being read, refused, or read with its parts to tick. */
  function drawTableOptions() {
    if (tableColumns === null) {
      return null;
    }
    return (
      <BajaAppTableOptions
        columns={tableColumns}
        onTickedPartHeadersChange={(tickedPartHeaders) =>
          setTableColumns((current) =>
            current?.phase === 'read' ? { ...current, tickedPartHeaders } : current,
          )
        }
      />
    );
  }

  return (
    <section aria-label={texts.pickerTitle}>
      <Card>
        <CardHeader>
          <CardTitle>
            <h3>{texts.pickerTitle}</h3>
          </CardTitle>
        </CardHeader>
        <form noValidate onSubmit={(event) => event.preventDefault()}>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
              <FormFieldRow
                label={texts.apiAddressLabel}
                controlId={ids.apiAddress}
                errorMessage={addressProblem}
              >
                <Input
                  id={ids.apiAddress}
                  value={apiAddress}
                  onChange={(event) => setApiAddress(event.target.value)}
                  {...buildErrorAttributesForControl(ids.apiAddress, addressProblem)}
                />
              </FormFieldRow>
              <FormFieldRow
                label={texts.eventIdLabel}
                controlId={ids.eventId}
                errorMessage={eventIdProblem}
              >
                <Input
                  id={ids.eventId}
                  value={eventId}
                  placeholder={texts.eventIdHint}
                  onChange={(event) => setEventId(event.target.value)}
                  {...buildErrorAttributesForControl(ids.eventId, eventIdProblem)}
                />
              </FormFieldRow>
              <Button
                type="button"
                variant="outline"
                disabled={eventReading.phase === 'reading'}
                onClick={() => void readTheEvent()}
              >
                {eventReading.phase === 'reading' ? texts.readingEvent : texts.readEventButton}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{texts.apiAddressHint}</p>
            {eventReading.phase === 'failed' && (
              <p role="alert" className="text-sm text-destructive">
                {eventReading.reason}
              </p>
            )}
            {eventReading.phase === 'read' && (
              <BajaAppEventChoices
                event={eventReading.event}
                chosenKey={chosenKey}
                onChoose={choose}
                optionsOfTheChoice={drawOptionsOfTheChoice()}
              />
            )}
          </CardContent>
          <CardFooter className="mt-4 gap-2">
            <Button type="button" disabled={choice === undefined} onClick={continueWithTheChoice}>
              {texts.continueButton}
            </Button>
            <Button type="button" variant="ghost" onClick={props.onClose}>
              {texts.cancelButton}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </section>
  );
}

/** A table's columns read, the overall table's parts ticked where the table has them. */
function buildColumnsRead(
  resultadoId: string,
  pointsHeader: string,
  partHeaderChoices: string[],
): TableColumnsState {
  return {
    phase: 'read',
    resultadoId,
    pointsHeader,
    partHeaderChoices,
    tickedPartHeaders: partHeaderChoices.filter((header) =>
      proposedScorePartHeaders.includes(header),
    ),
  };
}
